import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ylgnftspegpfcuuwifia.supabase.co";
const supabaseKey = "sb_publishable_Z6J9esc95awmxgY3Nw5USw_8KCWrbGC";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [invites, setInvites] = useState([]);
  const [tab, setTab] = useState("N");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [groupByArea, setGroupByArea] = useState(true);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchInvites();
    const channel = supabase
      .channel("invites-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invites" },
        fetchInvites
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchInvites = async () => {
    const { data } = await supabase.from("invites").select("*");
    setInvites(data || []);
  };

  const saveInvite = async () => {
    if (!name || !area) return;
    if (editingId) {
      await supabase.from("invites").update({ name, area }).eq("id", editingId);
    } else {
      await supabase.from("invites").insert([{ name, area, category: tab }]);
    }
    setName("");
    setArea("");
    setEditingId(null);
    setShowModal(false);
  };

  const toggleInvited = async (id, value) => {
    await supabase.from("invites").update({ invited: !value }).eq("id", id);
  };

  const deleteInvite = async (id) => {
    if (!confirm("Delete?")) return;
    await supabase.from("invites").delete().eq("id", id);
  };

  const editInvite = (inv) => {
    setName(inv.name);
    setArea(inv.area);
    setEditingId(inv.id);
    setShowModal(true);
  };

  const fullyFiltered = invites.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) &&
      (areaFilter === "ALL" || i.area === areaFilter) &&
      (statusFilter === "ALL" ||
        (statusFilter === "DONE" && i.invited) ||
        (statusFilter === "PENDING" && !i.invited))
  );

  const tabCounts = {
    N: fullyFiltered.filter((i) => i.category === "N").length,
    W: fullyFiltered.filter((i) => i.category === "W").length,
    P: fullyFiltered.filter((i) => i.category === "P").length,
  };

  const filtered = fullyFiltered.filter((i) => i.category === tab);

  const grouped = useMemo(() => {
    if (!groupByArea) return { All: filtered };
    return filtered.reduce((acc, item) => {
      acc[item.area] = acc[item.area] || [];
      acc[item.area].push(item);
      return acc;
    }, {});
  }, [filtered, groupByArea]);

  const progress = filtered.length
    ? Math.round(
        (filtered.filter((i) => i.invited).length / filtered.length) * 100
      )
    : 0;

  const areas = ["ALL", ...new Set(invites.map((i) => i.area))];

  return (
    <div style={container}>
      {/* HEADER */}
      <div style={header}>
        <h3>Invitation Manager</h3>

        <div style={progressBg}>
          <div style={{ ...progressFill, width: `${progress}%` }} />
        </div>

        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={input}
        />

        <div style={filterRow}>
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            style={input}
          >
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={input}
          >
            <option value="ALL">All</option>
            <option value="DONE">Invited</option>
            <option value="PENDING">Not Invited</option>
          </select>
        </div>

        <button onClick={() => setGroupByArea(!groupByArea)} style={groupBtn}>
          {groupByArea ? "Grouped by Area" : "Flat List"}
        </button>
      </div>

      {/* LIST */}
      <div style={{ padding: 12, paddingBottom: 140 }}>
        {Object.keys(grouped).map((area) => (
          <div key={area}>
            {groupByArea && <h4 style={areaTitle}>{area}</h4>}

            {grouped[area].map((inv) => (
              <SwipeCard
                key={inv.id}
                inv={inv}
                onToggle={toggleInvited}
                onDelete={deleteInvite}
                onEdit={editInvite}
              />
            ))}
          </div>
        ))}
      </div>

      {/* FAB */}
      <button style={fab} onClick={() => setShowModal(true)}>
        +
      </button>

      {/* NAV */}
      <div style={bottomNav}>
        {[
          { key: "N", label: "In-Person" },
          { key: "W", label: "WhatsApp" },
          { key: "P", label: "Postal" },
        ].map((t) => (
          <div
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...navItem, color: tab === t.key ? "#ff00cc" : "#aaa" }}
          >
            {t.label} ({tabCounts[t.key]})
          </div>
        ))}
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={overlay} onClick={() => setShowModal(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Edit" : "Add"}</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              style={input}
            />
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Area"
              style={input}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={saveInvite} style={primaryBtn}>
                Save
              </button>
              <button onClick={() => setShowModal(false)} style={secondaryBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🔥 SWIPE CARD
function SwipeCard({ inv, onToggle, onDelete, onEdit }) {
  const [dx, setDx] = useState(0);
  const startX = useRef(null);

  const start = (e) => {
    startX.current = e.touches ? e.touches[0].clientX : e.clientX;
  };
  const move = (e) => {
    if (startX.current === null) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    setDx(x - startX.current);
  };
  const end = () => {
    if (dx > 80) onToggle(inv.id, inv.invited); // 👉 right swipe = complete
    if (dx < -80) onDelete(inv.id); // 👉 left swipe = delete
    setDx(0);
    startX.current = null;
  };

  return (
    <div
      onMouseDown={start}
      onMouseMove={move}
      onMouseUp={end}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={end}
      style={{
        ...card,
        transform: `translateX(${Math.max(Math.min(dx, 80), -80)}px)`,
        background: inv.invited
          ? "linear-gradient(135deg,#00c853,#2e7d32)"
          : "#1c1c2e",
      }}
    >
      <span>{inv.name}</span>

      <div style={actionGroup}>
        <button style={iconBtn} onClick={() => onEdit(inv)}>
          ✏️
        </button>
        <button style={iconBtn} onClick={() => onDelete(inv.id)}>
          🗑️
        </button>
        <button style={checkBtn} onClick={() => onToggle(inv.id, inv.invited)}>
          {inv.invited ? "❌" : "✓"}
        </button>
      </div>
    </div>
  );
}

// 🎨 STYLES
const container = {
  minHeight: "100vh",
  background: "#0f0c29",
  color: "white",
  overflowX: "hidden",
};
const header = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  padding: 16,
  background: "#0f0c29",
};
const input = {
  padding: 10,
  borderRadius: 12,
  border: "none",
  width: "100%",
  marginTop: 8,
};
const filterRow = { display: "flex", gap: 8 };
const progressBg = { height: 6, background: "#333", borderRadius: 10 };
const progressFill = { height: 6, background: "#ff00cc", borderRadius: 10 };
const groupBtn = {
  marginTop: 8,
  padding: 8,
  borderRadius: 10,
  background: "#222",
  color: "white",
};
const areaTitle = { color: "#aaa" };
const card = {
  padding: 12,
  marginTop: 8,
  borderRadius: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  overflow: "hidden",
};
const actionGroup = { display: "flex", gap: 8, flexShrink: 0 };
const iconBtn = {
  padding: "6px 8px",
  borderRadius: 8,
  background: "#333",
  color: "white",
  border: "none",
};
const checkBtn = {
  padding: "6px 10px",
  borderRadius: 20,
  background: "#00c853",
  color: "white",
  border: "none",
};
const fab = {
  position: "fixed",
  bottom: 90,
  right: 20,
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "#ff00cc",
  border: "none",
  color: "white",
  zIndex: 30,
};
const bottomNav = {
  position: "fixed",
  bottom: 0,
  width: "100%",
  height: 60,
  background: "#111",
  display: "flex",
  justifyContent: "space-around",
  alignItems: "center",
};
const navItem = { fontSize: 12 };
const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};
const modal = { background: "#222", padding: 20, borderRadius: 16 };
const primaryBtn = {
  padding: 10,
  borderRadius: 10,
  background: "#ff00cc",
  color: "white",
  border: "none",
};
const secondaryBtn = {
  padding: 10,
  borderRadius: 10,
  background: "#555",
  color: "white",
  border: "none",
};
