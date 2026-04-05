import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCXw-32c6j3kclBLubaqsTE4DJgtPPAYlo",
  authDomain: "compost-app-7ed4d.firebaseapp.com",
  projectId: "compost-app-7ed4d",
  storageBucket: "compost-app-7ed4d.firebasestorage.app",
  messagingSenderId: "724477643042",
  appId: "1:724477643042:web:7a847d604842966e97fd7b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// デフォルトの切り返し間隔
const DEFAULT_SCHEDULE = [
 { label: "1回目",  daysFromPrev: 7,  note: "加水の判断" },
  { label: "2回目",  daysFromPrev: 7,  note: "加水の判断" },
  { label: "3回目",  daysFromPrev: 14, note: "加水の判断" },
  { label: "4回目",  daysFromPrev: 14, note: "加水の判断" },
  { label: "5回目",  daysFromPrev: 21, note: "" },
  { label: "6回目",  daysFromPrev: 21, note: "" },
  { label: "7回目",  daysFromPrev: 30, note: "" },
  { label: "8回目",  daysFromPrev: 30, note: "" },
  { label: "9回目",  daysFromPrev: 30, note: "" },
  { label: "10回目", daysFromPrev: 30, note: "" },
];

const YARD_OPTIONS = {
  "立野原": Array.from({length:4},  (_,i) => `立野原${["①","②","③","④"][i]}`),
  "大鋸屋": Array.from({length:15}, (_,i) => `大鋸屋${["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮"][i]}`),
  "牛舎":   Array.from({length:9},  (_,i) => `牛舎${["①","②","③","④","⑤","⑥","⑦","⑧","⑨"][i]}`),
};

const LOT_PREFIXES = { "麦芽粕堆肥": "ミ", "草堆肥": "ヒ", "落葉堆肥": "フ", "魚粕堆肥": "魚" };
const COMPOST_TYPES = ["麦芽粕堆肥", "草堆肥", "落葉堆肥", "魚粕堆肥"];
const LOT_NUMBERS  = Array.from({length:12}, (_,i) => String(i+1));

// スケジュールを取得（カスタムがあればそちらを使う）
function getSchedule(batch) {
  if (batch?.customSchedule) return batch.customSchedule;
  return DEFAULT_SCHEDULE;
}

function calcTurnings(startDate, actualDates = {}, schedule = DEFAULT_SCHEDULE, customDates = {}) {
  const turnings = [];
  let prevDate = new Date(startDate);
  for (let i = 0; i < schedule.length; i++) {
    const t = schedule[i];
    const actual = actualDates[i];
    // カスタム予定日があればそちらを使う
    const customDate = customDates[i] ? new Date(customDates[i]) : null;
    const scheduled = customDate || new Date(prevDate.getTime() + t.daysFromPrev * 86400000);
    const baseDate  = actual ? new Date(actual) : scheduled;
    turnings.push({
      ...t, index: i,
      scheduledDate: scheduled,
      date: baseDate,
      actualDate: actual || null,
      done: !!actual,
      delayed: actual ? Math.round((new Date(actual) - scheduled) / 86400000) : 0,
    });
    prevDate = baseDate;
  }
  return turnings;
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatJP(d) {
  const days = ["日","月","火","水","木","金","土"];
  return `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`;
}
function getDiff(d) {
  const today = new Date(); today.setHours(0,0,0,0);
  const t = new Date(d); t.setHours(0,0,0,0);
  return Math.round((t - today) / 86400000);
}

const TYPE_COLOR = {
  "麦芽粕堆肥": { bg:"#fef3c7", text:"#92400e", dot:"#f59e0b", light:"#fffbeb", border:"#fde68a", shortLabel:"🍺 麦芽粕" },
  "草堆肥":     { bg:"#dcfce7", text:"#15803d", dot:"#16a34a", light:"#f0fdf4", border:"#bbf7d0", shortLabel:"🌿 草" },
  "落葉堆肥":   { bg:"#fce7d6", text:"#7c2d12", dot:"#ea580c", light:"#fff7ed", border:"#fed7aa", shortLabel:"🍂 落葉" },
  "魚粕堆肥":   { bg:"#e0e7ff", text:"#3730a3", dot:"#4f46e5", light:"#eef2ff", border:"#c7d2fe", shortLabel:"🐟 魚粕" },
};
const STATUS = {
  done:     { bg:"#f1f5f9", border:"#cbd5e1", text:"#64748b", tag:"#94a3b8" },
  today:    { bg:"#fffbeb", border:"#fbbf24", text:"#92400e", tag:"#f59e0b" },
  soon:     { bg:"#fff7ed", border:"#fb923c", text:"#9a3412", tag:"#fb923c" },
  upcoming: { bg:"#f0f9ff", border:"#7dd3fc", text:"#0c4a6e", tag:"#38bdf8" },
  far:      { bg:"#f8fafc", border:"#e2e8f0", text:"#64748b", tag:"#94a3b8" },
};
function getStatus(date) {
  const d = getDiff(date);
  if (d < 0) return "done";
  if (d === 0) return "today";
  if (d <= 3)  return "soon";
  if (d <= 14) return "upcoming";
  return "far";
}

function YardSelector({ value, onChange, label = "ヤード" }) {
  return (
    <div>
      {label && <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8 }}>{label}</div>}
      {Object.entries(YARD_OPTIONS).map(([group, yards]) => (
        <div key={group} style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:5 }}>{group}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {yards.map(y => (
              <button key={y} onClick={() => onChange(y)}
                style={{ padding:"6px 12px", borderRadius:8, border:"1.5px solid",
                  borderColor:value===y?"#15803d":"#e2e8f0", background:value===y?"#15803d":"white",
                  color:value===y?"white":"#374151", cursor:"pointer", fontSize:13,
                  fontWeight:value===y?700:400, fontFamily:"inherit" }}>
                {y}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LotSelector({ type, value, onChange }) {
  const prefix = LOT_PREFIXES[type] || "";
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8 }}>ロット番号</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {LOT_NUMBERS.map(n => {
          const lot = `${prefix}${n}`;
          return (
            <button key={n} onClick={() => onChange(lot)}
              style={{ width:48, height:48, borderRadius:10, border:"1.5px solid",
                borderColor:value===lot?"#15803d":"#e2e8f0", background:value===lot?"#15803d":"white",
                color:value===lot?"white":"#374151", cursor:"pointer", fontSize:14,
                fontWeight:value===lot?700:400, fontFamily:"inherit" }}>
              {lot}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 切り返し間隔設定コンポーネント
function ScheduleEditor({ schedule, onChange }) {
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8 }}>
        切り返し間隔（日数）
        <span style={{ fontSize:11, fontWeight:400, color:"#94a3b8", marginLeft:8 }}>※ 前回からの日数</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {schedule.map((t, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"#f8fafc", borderRadius:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#374151", minWidth:50 }}>{t.label}</span>
            <input
              type="number" min="1" max="90" value={t.daysFromPrev}
              onChange={e => {
                const newSchedule = schedule.map((s, j) =>
                  j === i ? { ...s, daysFromPrev: Number(e.target.value) || 1 } : s
                );
                onChange(newSchedule);
              }}
              style={{ width:60, padding:"4px 8px", borderRadius:6, border:"1.5px solid #d1fae5",
                fontSize:14, fontFamily:"inherit", textAlign:"center", outline:"none" }}
            />
            <span style={{ fontSize:12, color:"#6b7280" }}>日後</span>
            {t.note && <span style={{ fontSize:11, color:"#94a3b8" }}>（{t.note}）</span>}
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...DEFAULT_SCHEDULE])}
        style={{ marginTop:8, padding:"6px 14px", borderRadius:8, border:"1.5px solid #d1fae5",
          background:"white", color:"#6b7280", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
        デフォルトに戻す
      </button>
    </div>
  );
}

export default function App() {
  const [userName, setUserName] = useState(() => localStorage.getItem("compost-username") || "");
  const [nameInput, setNameInput] = useState("");
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("schedule");
  const [selectedId, setSelectedId] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [filterType, setFilterType] = useState("すべて");
  const [filterStatus, setFilterStatus] = useState("進行中");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);

  const defaultForm = {
    type:"麦芽粕堆肥", lot:"ミ1",
    startDate:new Date().toISOString().split("T")[0],
    startYard:"", currentYard:"", note:"",
    customSchedule:[...DEFAULT_SCHEDULE]
  };
  const [form, setForm] = useState(defaultForm);

  const [recordModal, setRecordModal] = useState(null);
  const [recordDate, setRecordDate] = useState("");
  const [recordYard, setRecordYard] = useState("");
  const [recordTemp, setRecordTemp] = useState("");
  const [recordWater, setRecordWater] = useState(null);
  const [recordNote, setRecordNote] = useState("");
  const [editingStartDate, setEditingStartDate] = useState(null);
  const [editingScheduledDate, setEditingScheduledDate] = useState(null); // {batchId, turnIndex}

  useEffect(() => {
    if (!userName) return;
    const docRef = doc(db, "compost", "data");
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBatches(data.batches || []);
        setLastUpdated(data.updatedAt || null);
      }
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsubscribe();
  }, [userName]);

  async function saveData(newBatches) {
    setSaving(true);
    try {
      const docRef = doc(db, "compost", "data");
      await setDoc(docRef, { batches:newBatches, updatedAt:new Date().toISOString(), updatedBy:userName });
      setBatches(newBatches);
      setLastUpdated(new Date().toISOString());
    } catch(e) { alert("保存に失敗しました: " + e.message); }
    finally { setSaving(false); }
  }

  async function updateStartDate(batchId, newDate) {
    if (!newDate) return;
    await saveData(batches.map(b =>
      b.id===batchId ? {...b, startDate:newDate, startDateEditedBy:userName, startDateEditedAt:new Date().toISOString()} : b
    ));
    setEditingStartDate(null);
  }

  // 予定日を直接編集
  async function updateScheduledDate(batchId, turnIndex, newDate) {
    if (!newDate) return;
    const newBatches = batches.map(b => {
      if (b.id !== batchId) return b;
      const customDates = { ...(b.customDates||{}), [turnIndex]: newDate };
      return { ...b, customDates };
    });
    await saveData(newBatches);
    setEditingScheduledDate(null);
  }

  async function addBatch() {
    if (!form.lot || !form.startDate || !form.startYard) { alert("ロット番号・仕込み日・ヤードを入力してください"); return; }
    const nb = {
      ...form, id:Date.now(), done:false,
      actualDates:{}, actualNotes:{}, actualTemps:{}, actualWaters:{},
      yardHistory:[], customDates:{},
      currentYard:form.startYard, createdBy:userName, createdAt:new Date().toISOString()
    };
    await saveData([...batches, nb]);
    setView("schedule");
    setForm(defaultForm);
    setShowScheduleEditor(false);
  }

  async function recordTurning() {
    if (!recordModal || !recordDate) return;
    const { batchId, turnIndex } = recordModal;
    const newBatches = batches.map(b => {
      if (b.id !== batchId) return b;
      const actualDates  = { ...(b.actualDates||{}) };
      const actualNotes  = { ...(b.actualNotes||{}) };
      const actualTemps  = { ...(b.actualTemps||{}) };
      const actualWaters = { ...(b.actualWaters||{}) };
      const yardHistory  = [...(b.yardHistory||[])];
      actualDates[turnIndex] = recordDate;
      if (recordNote)  actualNotes[turnIndex]  = recordNote;
      if (recordTemp)  actualTemps[turnIndex]  = recordTemp;
      if (recordWater !== null) actualWaters[turnIndex] = recordWater;
      const newYard = recordYard || b.currentYard;
      yardHistory.push({ turnIndex, date:recordDate, fromYard:b.currentYard, toYard:newYard, by:userName });
      return { ...b, actualDates, actualNotes, actualTemps, actualWaters, yardHistory, currentYard:newYard };
    });
    await saveData(newBatches);
    setRecordModal(null); setRecordYard(""); setRecordNote(""); setRecordTemp(""); setRecordWater(null);
  }

  async function undoTurning(batchId, turnIndex) {
    if (!window.confirm(`切り返し${getSchedule(batches.find(b=>b.id===batchId))[turnIndex].label}の実施記録を取り消しますか？`)) return;
    const newBatches = batches.map(b => {
      if (b.id !== batchId) return b;
      const actualDates  = { ...(b.actualDates||{}) };
      const actualNotes  = { ...(b.actualNotes||{}) };
      const actualTemps  = { ...(b.actualTemps||{}) };
      const actualWaters = { ...(b.actualWaters||{}) };
      const yardHistory  = (b.yardHistory||[]).filter(h => h.turnIndex !== turnIndex);
      delete actualDates[turnIndex]; delete actualNotes[turnIndex];
      delete actualTemps[turnIndex]; delete actualWaters[turnIndex];
      const lastH = [...yardHistory].reverse().find(h => h.turnIndex < turnIndex);
      return { ...b, actualDates, actualNotes, actualTemps, actualWaters, yardHistory, currentYard:lastH?lastH.toYard:b.startYard };
    });
    await saveData(newBatches);
  }

  async function markDone(id) {
    await saveData(batches.map(b => b.id===id ? {...b, done:true, doneBy:userName, doneAt:new Date().toISOString()} : b));
    setView("schedule");
  }
  async function deleteBatch(id) {
    if (!window.confirm("この仕込みを削除しますか？")) return;
    await saveData(batches.filter(b => b.id!==id));
    setView("schedule");
  }

  function handleLogin() {
    if (!nameInput.trim()) return;
    localStorage.setItem("compost-username", nameInput.trim());
    setUserName(nameInput.trim());
  }

  if (!userName) return (
    <div style={{ fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif", background:"linear-gradient(160deg,#f0fdf4,#dcfce7)", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"white", borderRadius:20, padding:"40px 32px", maxWidth:360, width:"90%", boxShadow:"0 8px 40px rgba(21,128,61,0.15)", textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:12 }}>🌱</div>
        <h1 style={{ margin:"0 0 6px", fontSize:22, color:"#166534", fontWeight:800 }}>堆肥管理</h1>
        <p style={{ margin:"0 0 28px", fontSize:13, color:"#6b7280" }}>切り返しスケジュール共有システム</p>
        <input value={nameInput} onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
          placeholder="名前を入力（例：山﨑）" autoFocus
          style={{ width:"100%", padding:14, borderRadius:12, border:"2px solid #d1fae5", fontSize:15, fontFamily:"inherit", boxSizing:"border-box", outline:"none", textAlign:"center", marginBottom:14 }} />
        <button onClick={handleLogin} disabled={!nameInput.trim()}
          style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:nameInput.trim()?"linear-gradient(135deg,#15803d,#16a34a)":"#e2e8f0", color:nameInput.trim()?"white":"#94a3b8", fontSize:16, fontWeight:700, cursor:nameInput.trim()?"pointer":"default", fontFamily:"inherit" }}>
          はじめる
        </button>
      </div>
    </div>
  );

  const selectedBatch = batches.find(b => b.id === selectedId);
  const allUpcoming = batches.filter(b=>!b.done).flatMap(b=>{
    const sched = getSchedule(b);
    return calcTurnings(b.startDate, b.actualDates||{}, sched, b.customDates||{})
      .map((t,i)=>({...t, batchId:b.id, lot:b.lot, batchType:b.type, yard:b.currentYard}))
      .filter(t=>!t.done && getDiff(t.date)>=0);
  }).sort((a,b)=>a.date-b.date);
  const todayCount = allUpcoming.filter(t=>getDiff(t.date)===0).length;
  const soonCount  = allUpcoming.filter(t=>getDiff(t.date)>0&&getDiff(t.date)<=7).length;
  const filtered   = batches.filter(b=>{
    const statusMatch = filterStatus==="進行中" ? !b.done : b.done;
    const typeMatch   = filterType==="すべて" || b.type===filterType;
    return statusMatch && typeMatch;
  });

  function getCalendarEvents() {
    const events = {};
    batches.filter(b=>!b.done).forEach(b=>{
      const sched = getSchedule(b);
      if (!events[b.startDate]) events[b.startDate]=[];
      events[b.startDate].push({ type:b.type, label:b.lot, batchId:b.id });
      calcTurnings(b.startDate, b.actualDates||{}, sched, b.customDates||{}).forEach((t,i)=>{
        const key = toDateStr(t.date);
        if (!events[key]) events[key]=[];
        events[key].push({ type:b.type, label:`${b.lot} 切${i+1}${t.done?"✓":""}`, batchId:b.id });
      });
    });
    return events;
  }

  const labelStyle = { display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:8 };
  const inputStyle = { width:"100%", padding:12, borderRadius:10, border:"1.5px solid #d1fae5", fontSize:14, fontFamily:"inherit", background:"white", outline:"none", boxSizing:"border-box", display:"block" };
  const navBtn = { background:"none", border:"1.5px solid #d1fae5", borderRadius:8, width:36, height:36, cursor:"pointer", fontSize:18, color:"#15803d", fontFamily:"inherit" };

  function renderCalendar() {
    const y=calMonth.getFullYear(), m=calMonth.getMonth();
    const first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
    const events=getCalendarEvents(), today=toDateStr(new Date());
    const cells=[]; for(let i=0;i<first;i++) cells.push(null); for(let d=1;d<=days;d++) cells.push(d);
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <button onClick={()=>setCalMonth(new Date(y,m-1,1))} style={navBtn}>‹</button>
          <span style={{ fontWeight:800, fontSize:18, color:"#166534" }}>{y}年{m+1}月</span>
          <button onClick={()=>setCalMonth(new Date(y,m+1,1))} style={navBtn}>›</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
          {["日","月","火","水","木","金","土"].map((d,i)=>(
            <div key={d} style={{ textAlign:"center", fontSize:12, fontWeight:700, color:i===0?"#ef4444":i===6?"#3b82f6":"#6b7280", padding:"4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
          {cells.map((d,i)=>{
            if(!d) return <div key={`e${i}`}/>;
            const key=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const evs=events[key]||[], isToday=key===today, dow=(first+d-1)%7;
            return (
              <div key={key} style={{ minHeight:64, background:isToday?"#dcfce7":"white", border:isToday?"2px solid #15803d":"1.5px solid #e2e8f0", borderRadius:8, padding:"4px 3px" }}>
                <div style={{ fontSize:12, fontWeight:isToday?800:500, color:isToday?"#15803d":dow===0?"#ef4444":dow===6?"#3b82f6":"#374151", marginBottom:2 }}>{d}</div>
                {evs.slice(0,3).map((ev,j)=>{
                  const tc=TYPE_COLOR[ev.type];
                  return <div key={j} onClick={()=>{setSelectedId(ev.batchId);setView("detail");}}
                    style={{ background:tc.bg, borderRadius:3, padding:"1px 4px", fontSize:9, fontWeight:700, color:tc.text, marginBottom:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", cursor:"pointer" }}>{ev.label}</div>;
                })}
                {evs.length>3&&<div style={{ fontSize:9, color:"#94a3b8" }}>+{evs.length-3}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#374151", marginBottom:10 }}>📌 直近の予定</div>
          {allUpcoming.slice(0,8).map((t,i)=>{
            const diff=getDiff(t.date), s=STATUS[getStatus(t.date)], tc=TYPE_COLOR[t.batchType]||TYPE_COLOR["麦芽粕堆肥"];
            return (
              <div key={i} onClick={()=>{setSelectedId(t.batchId);setView("detail");}}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:10, marginBottom:6, cursor:"pointer", background:s.bg, border:`1.5px solid ${s.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:8, height:8, background:tc.dot, borderRadius:"50%", flexShrink:0 }}/>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:s.text }}>{t.lot} — 切り返し{t.label}</div>
                    <div style={{ fontSize:11, color:"#6b7280" }}>{t.yard}</div>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:s.text }}>{formatJP(t.date)}</div>
                  <div style={{ fontSize:11, color:s.tag, fontWeight:700 }}>{diff===0?"本日！":diff===1?"明日":`${diff}日後`}</div>
                </div>
              </div>
            );
          })}
          {allUpcoming.length===0&&<div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:20 }}>予定はありません</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif", background:"#f0fdf4", minHeight:"100vh" }}>

      {/* ── 実施記録モーダル ── */}
      {recordModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e=>{ if(e.target===e.currentTarget){setRecordModal(null);setRecordYard("");setRecordNote("");setRecordTemp("");setRecordWater(null);} }}>
          <div style={{ background:"white", borderRadius:"20px 20px 0 0", padding:"28px 20px 32px", maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ width:40, height:4, background:"#e2e8f0", borderRadius:2, margin:"0 auto 20px" }}/>
            <h3 style={{ margin:"0 0 4px", fontSize:18, color:"#166534" }}>✅ 切り返し{recordModal.label}を実施</h3>
            <p style={{ margin:"0 0 20px", fontSize:13, color:"#6b7280" }}><strong>{recordModal.lot}</strong> — 記録を入力してください</p>
            <label style={labelStyle}>実施日</label>
            <input type="date" value={recordDate} onChange={e=>setRecordDate(e.target.value)} style={{ ...inputStyle, marginBottom:16 }}/>
            {recordDate && (() => {
              const diff=Math.round((new Date(recordDate)-new Date(recordModal.scheduledDate))/86400000);
              return diff!==0?(
                <div style={{ marginBottom:16, padding:"8px 12px", borderRadius:8, background:Math.abs(diff)>3?"#fff7ed":"#f0fdf4", border:`1px solid ${Math.abs(diff)>3?"#fb923c":"#86efac"}`, fontSize:12, color:Math.abs(diff)>3?"#9a3412":"#166534" }}>
                  {diff>0?`⚠️ 予定より${diff}日遅れ`:`✨ 予定より${Math.abs(diff)}日早め`}実施。以降の予定日が再計算されます。
                </div>
              ):(
                <div style={{ marginBottom:16, padding:"8px 12px", borderRadius:8, background:"#f0fdf4", border:"1px solid #86efac", fontSize:12, color:"#166534" }}>✅ 予定通りの実施日です。</div>
              );
            })()}
            <label style={labelStyle}>🌡️ 温度（℃）</label>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <div style={{ position:"relative", flex:1 }}>
                <input type="number" min="0" max="100" step="0.1" value={recordTemp} onChange={e=>setRecordTemp(e.target.value)} placeholder="例：68.5"
                  style={{ ...inputStyle, paddingRight:36, marginBottom:0, borderColor:recordTemp?(Number(recordTemp)<55?"#fb923c":"#86efac"):"#d1fae5", background:recordTemp?(Number(recordTemp)<55?"#fff7ed":"#f0fdf4"):"white" }}/>
                <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#94a3b8" }}>℃</span>
              </div>
              {recordTemp&&(
                <div style={{ padding:"8px 14px", borderRadius:10, fontSize:13, fontWeight:700, whiteSpace:"nowrap", background:Number(recordTemp)>=55?"#dcfce7":"#fff7ed", color:Number(recordTemp)>=55?"#15803d":"#9a3412", border:`1.5px solid ${Number(recordTemp)>=55?"#86efac":"#fb923c"}` }}>
                  {Number(recordTemp)>=70?"🔥 高温":Number(recordTemp)>=55?"✅ 適温":"⚠️ 55℃以下"}
                </div>
              )}
            </div>
            {recordTemp&&Number(recordTemp)<55&&(
              <div style={{ marginBottom:16, padding:"8px 12px", borderRadius:8, background:"#fff7ed", border:"1px solid #fb923c", fontSize:12, color:"#9a3412" }}>
                ⚠️ 55℃を下回っています。加水は基本的にやめる。判断に迷ったら山﨑に確認。
              </div>
            )}
            <label style={labelStyle}>💧 加水</label>
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {[
                { val:true,  label:"💧 あり", activeBg:"#eff6ff", activeColor:"#1d4ed8", activeBorder:"#93c5fd" },
                { val:false, label:"なし",    activeBg:"#f8fafc", activeColor:"#475569", activeBorder:"#cbd5e1" },
              ].map(opt=>(
                <button key={String(opt.val)} onClick={()=>setRecordWater(recordWater===opt.val?null:opt.val)}
                  style={{ flex:1, padding:"12px 0", borderRadius:10, border:"2px solid", borderColor:recordWater===opt.val?opt.activeBorder:"#e2e8f0", background:recordWater===opt.val?opt.activeBg:"white", color:recordWater===opt.val?opt.activeColor:"#94a3b8", fontWeight:recordWater===opt.val?700:400, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom:16 }}>
              <YardSelector value={recordYard} onChange={setRecordYard} label={`切り返し後のヤード（現在：${recordModal.currentYard||"未設定"}）`}/>
              {!recordYard&&<div style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>※ 変更がなければ選択不要</div>}
            </div>
            <label style={labelStyle}>メモ（任意）</label>
            <textarea value={recordNote} onChange={e=>setRecordNote(e.target.value)} placeholder="気になったこと、状態のメモなど" rows={2} style={{ ...inputStyle, marginBottom:20, resize:"vertical" }}/>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>{setRecordModal(null);setRecordYard("");setRecordNote("");setRecordTemp("");setRecordWater(null);}}
                style={{ flex:1, padding:13, borderRadius:10, border:"2px solid #d1fae5", background:"white", color:"#6b7280", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                キャンセル
              </button>
              <button onClick={recordTurning} disabled={!recordDate||saving}
                style={{ flex:2, padding:13, borderRadius:10, border:"none", background:recordDate?"linear-gradient(135deg,#15803d,#16a34a)":"#e2e8f0", color:recordDate?"white":"#94a3b8", fontSize:14, fontWeight:700, cursor:recordDate?"pointer":"default", fontFamily:"inherit" }}>
                {saving?"保存中…":"記録して予定を更新"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#166534,#15803d)", color:"white", padding:"14px 16px" }}>
        <div style={{ maxWidth:640, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:26 }}>🌱</span>
              <div>
                <div style={{ fontSize:18, fontWeight:800 }}>堆肥管理</div>
                <div style={{ fontSize:11, opacity:0.8 }}>{userName}さん</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {saving&&<span style={{ fontSize:11, opacity:0.8 }}>保存中…</span>}
              {lastUpdated&&!saving&&<span style={{ fontSize:10, opacity:0.7 }}>{new Date(lastUpdated).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})} 更新</span>}
              <button onClick={()=>{localStorage.removeItem("compost-username");setUserName("");}}
                style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:8, color:"white", padding:"6px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>退出</button>
            </div>
          </div>
          {(todayCount>0||soonCount>0)&&(
            <div style={{ marginTop:10, background:"rgba(255,255,255,0.15)", borderRadius:10, padding:"8px 14px", display:"flex", gap:16, flexWrap:"wrap" }}>
              {todayCount>0&&<span style={{ fontSize:13 }}>🔴 本日の切り返し：<strong>{todayCount}件</strong></span>}
              {soonCount>0&&<span style={{ fontSize:13 }}>🟡 7日以内：<strong>{soonCount}件</strong></span>}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div style={{ background:"white", borderBottom:"1px solid #d1fae5", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:640, margin:"0 auto", display:"flex" }}>
          {[{key:"schedule",label:"📋 一覧"},{key:"calendar",label:"📅 カレンダー"},{key:"add",label:"＋ 仕込み"}].map(nav=>(
            <button key={nav.key} onClick={()=>setView(nav.key)}
              style={{ flex:1, padding:"12px 0", border:"none", background:"transparent", fontWeight:view===nav.key?700:400, color:view===nav.key?"#15803d":"#6b7280", borderBottom:view===nav.key?"3px solid #15803d":"3px solid transparent", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>
              {nav.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:16 }}>

        {/* ── 一覧 ── */}
        {view==="schedule"&&(
          <div>
            <div style={{ display:"flex", background:"#e8f5e9", borderRadius:12, padding:4, marginBottom:14, gap:4 }}>
              {["進行中","完了"].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", background:filterStatus===s?"white":"transparent", color:filterStatus===s?"#166534":"#6b7280", fontWeight:filterStatus===s?700:400, cursor:"pointer", fontSize:14, fontFamily:"inherit", boxShadow:filterStatus===s?"0 1px 4px rgba(0,0,0,0.1)":"none" }}>
                  {s==="進行中"?`🌱 進行中 (${batches.filter(b=>!b.done).length})`:`✅ 完了 (${batches.filter(b=>b.done).length})`}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              {["すべて",...COMPOST_TYPES].map(t=>(
                <button key={t} onClick={()=>setFilterType(t)}
                  style={{ padding:"5px 12px", borderRadius:20, border:"2px solid", borderColor:filterType===t?"#15803d":"#d1fae5", background:filterType===t?"#15803d":"white", color:filterType===t?"white":"#15803d", cursor:"pointer", fontSize:11, fontWeight:filterType===t?700:400, fontFamily:"inherit" }}>
                  {t==="すべて"?"すべて":TYPE_COLOR[t]?.shortLabel||t}
                </button>
              ))}
            </div>
            {loading&&<div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>読み込み中…</div>}
            {!loading&&filtered.length===0&&(
              <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>
                <div style={{ fontSize:48, marginBottom:10 }}>🌾</div>
                <div style={{ fontWeight:600 }}>仕込みがありません</div>
              </div>
            )}
            {filtered.map(batch=>{
              const sched = getSchedule(batch);
              const turnings=calcTurnings(batch.startDate, batch.actualDates||{}, sched, batch.customDates||{});
              const completedCount=turnings.filter(t=>t.done).length;
              const next=turnings.find(t=>!t.done&&getDiff(t.date)>=0);
              const tc=TYPE_COLOR[batch.type]||TYPE_COLOR["麦芽粕堆肥"];
              return (
                <div key={batch.id} onClick={()=>{setSelectedId(batch.id);setView("detail");}}
                  style={{ background:"white", borderRadius:14, marginBottom:12, padding:16, boxShadow:"0 2px 12px rgba(21,128,61,0.07)", border:`1.5px solid ${batch.done?"#bbf7d0":"#d1fae5"}`, cursor:"pointer" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:22, fontWeight:800, color:tc.text }}>{batch.lot}</span>
                        <span style={{ background:tc.bg, color:tc.text, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{tc.shortLabel}</span>
                        {batch.done&&<span style={{ background:"#15803d", color:"white", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>✅ 完了</span>}
                        {batch.customSchedule&&<span style={{ background:"#f0f9ff", color:"#0369a1", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>📐 カスタム</span>}
                      </div>
                      <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>仕込み：{formatJP(new Date(batch.startDate))} by {batch.createdBy}</div>
                      {batch.done&&batch.doneAt&&<div style={{ fontSize:12, color:"#15803d", marginTop:2, fontWeight:600 }}>完了：{formatJP(new Date(batch.doneAt))} by {batch.doneBy}</div>}
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                        <span style={{ fontSize:12, color:"#6b7280" }}>📍 現在:</span>
                        <span style={{ fontSize:13, fontWeight:700, color:"#166534" }}>{batch.currentYard||"未設定"}</span>
                      </div>
                    </div>
                    <span style={{ color:"#cbd5e1", fontSize:20 }}>›</span>
                  </div>
                  <div style={{ marginBottom:next&&!batch.done?10:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#94a3b8", marginBottom:3 }}>
                      <span>切り返し進捗</span><span>{completedCount}/{turnings.length}</span>
                    </div>
                    <div style={{ height:7, background:"#f1f5f9", borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(completedCount/turnings.length)*100}%`, background:"linear-gradient(90deg,#15803d,#4ade80)", borderRadius:4 }}/>
                    </div>
                  </div>
                  {next&&!batch.done&&(()=>{
                    const diff=getDiff(next.date), s=STATUS[getStatus(next.date)];
                    return (
                      <div style={{ background:s.bg, border:`1.5px solid ${s.border}`, borderRadius:8, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:s.text }}>次：切り返し{next.label}{next.note&&<span style={{ fontWeight:400, opacity:0.8 }}>（{next.note}）</span>}</div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:12, fontWeight:700, color:s.text }}>{formatJP(next.date)}</div>
                          <div style={{ fontSize:11, color:s.tag, fontWeight:700 }}>{diff===0?"本日！":diff===1?"明日":`${diff}日後`}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {/* ── カレンダー ── */}
        {view==="calendar"&&(
          <div style={{ background:"white", borderRadius:16, padding:20, boxShadow:"0 2px 12px rgba(21,128,61,0.07)", border:"1.5px solid #d1fae5" }}>
            {renderCalendar()}
          </div>
        )}

        {/* ── 新規仕込み ── */}
        {view==="add"&&(
          <div style={{ background:"white", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(21,128,61,0.07)", border:"1.5px solid #d1fae5" }}>
            <h2 style={{ margin:"0 0 24px", fontSize:17, fontWeight:800, color:"#166534" }}>新規仕込み登録</h2>
            <label style={labelStyle}>堆肥の種類</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
              {COMPOST_TYPES.map(t=>{
                const tc=TYPE_COLOR[t];
                return (
                  <button key={t} onClick={()=>setForm({...form,type:t,lot:`${LOT_PREFIXES[t]}1`})}
                    style={{ padding:"12px 8px", borderRadius:10, border:"2px solid", borderColor:form.type===t?"#15803d":"#d1fae5", background:form.type===t?tc.bg:"white", color:form.type===t?tc.text:"#94a3b8", cursor:"pointer", fontWeight:form.type===t?700:400, fontSize:13, fontFamily:"inherit" }}>
                    {tc.shortLabel}
                  </button>
                );
              })}
            </div>
            <div style={{ marginBottom:20 }}><LotSelector type={form.type} value={form.lot} onChange={lot=>setForm({...form,lot})}/></div>
            <label style={labelStyle}>仕込み日</label>
            <input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} style={{ ...inputStyle, marginBottom:20 }}/>
            <div style={{ marginBottom:20 }}><YardSelector value={form.startYard} onChange={v=>setForm({...form,startYard:v,currentYard:v})} label="仕込みヤード"/></div>
            <label style={labelStyle}>メモ（任意）</label>
            <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="特記事項など" rows={2} style={{ ...inputStyle, marginBottom:20, resize:"vertical" }}/>

            {/* 切り返し間隔設定 */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <label style={{ ...labelStyle, marginBottom:0 }}>切り返しスケジュール</label>
                <button onClick={()=>setShowScheduleEditor(!showScheduleEditor)}
                  style={{ padding:"5px 12px", borderRadius:8, border:"1.5px solid #d1fae5", background:showScheduleEditor?"#dcfce7":"white", color:showScheduleEditor?"#15803d":"#6b7280", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:showScheduleEditor?700:400 }}>
                  {showScheduleEditor?"▲ 閉じる":"✏️ 間隔をカスタマイズ"}
                </button>
              </div>
              {showScheduleEditor ? (
                <ScheduleEditor schedule={form.customSchedule} onChange={s=>setForm({...form,customSchedule:s})}/>
              ) : (
                <div style={{ padding:12, background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0" }}>
                  <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>現在の設定（クリックして変更）</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {form.customSchedule.map((t,i)=>(
                      <span key={i} style={{ fontSize:11, padding:"3px 8px", background:"white", border:"1px solid #e2e8f0", borderRadius:6, color:"#374151" }}>
                        {t.label}:{t.daysFromPrev}日
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {form.startDate&&(
              <div style={{ marginBottom:20, padding:14, background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8 }}>📅 切り返し予定日</div>
                {calcTurnings(form.startDate, {}, form.customSchedule).map((t,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:i<form.customSchedule.length-1?"1px solid #f1f5f9":"none", fontSize:12 }}>
                    <span style={{ color:"#374151", fontWeight:600 }}>{t.label}{t.note&&<span style={{ color:"#94a3b8", fontWeight:400 }}>（{t.note}）</span>}</span>
                    <span style={{ color:"#15803d", fontWeight:700 }}>{formatJP(t.date)}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={addBatch} disabled={saving}
              style={{ width:"100%", padding:15, borderRadius:12, border:"none", background:"linear-gradient(135deg,#15803d,#16a34a)", color:"white", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 15px rgba(21,128,61,0.3)" }}>
              🌱 仕込みを登録する
            </button>
          </div>
        )}

        {/* ── 詳細 ── */}
        {view==="detail"&&selectedBatch&&(()=>{
          const sched = getSchedule(selectedBatch);
          const turnings=calcTurnings(selectedBatch.startDate, selectedBatch.actualDates||{}, sched, selectedBatch.customDates||{});
          const tc=TYPE_COLOR[selectedBatch.type]||TYPE_COLOR["麦芽粕堆肥"];
          return (
            <div>
              <button onClick={()=>setView("schedule")} style={{ background:"none", border:"none", color:"#15803d", fontSize:14, cursor:"pointer", fontFamily:"inherit", marginBottom:14, padding:0, fontWeight:600 }}>← 一覧に戻る</button>

              <div style={{ background:"white", borderRadius:14, padding:18, marginBottom:12, boxShadow:"0 2px 12px rgba(21,128,61,0.07)", border:"1.5px solid #d1fae5" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:32, fontWeight:800, color:tc.text, lineHeight:1 }}>{selectedBatch.lot}</div>
                    <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>{tc.shortLabel} — {selectedBatch.type}</div>
                  </div>
                  {selectedBatch.done&&(
                    <div style={{ textAlign:"right" }}>
                      <span style={{ background:"#15803d", color:"white", borderRadius:8, padding:"4px 12px", fontSize:13, fontWeight:700, display:"block" }}>✅ 完了</span>
                      {selectedBatch.doneAt&&<div style={{ fontSize:11, color:"#15803d", marginTop:4 }}>{formatJP(new Date(selectedBatch.doneAt))}</div>}
                    </div>
                  )}
                </div>
                <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div onClick={()=>!selectedBatch.done&&setEditingStartDate(editingStartDate===selectedBatch.id?null:selectedBatch.id)}
                    style={{ background:editingStartDate===selectedBatch.id?"#f0fdf4":"#f8fafc", borderRadius:8, padding:"8px 12px", border:editingStartDate===selectedBatch.id?"2px solid #15803d":"2px solid transparent", cursor:selectedBatch.done?"default":"pointer" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>仕込み日</div>
                      {!selectedBatch.done&&<div style={{ fontSize:10, color:"#15803d", fontWeight:600 }}>✏️ 編集</div>}
                    </div>
                    {editingStartDate===selectedBatch.id?(
                      <div onClick={e=>e.stopPropagation()}>
                        <input type="date" defaultValue={selectedBatch.startDate} id="startDateInput"
                          style={{ width:"100%", padding:"4px 6px", borderRadius:6, border:"1.5px solid #15803d", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", outline:"none", marginBottom:6 }} autoFocus/>
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={()=>setEditingStartDate(null)} style={{ flex:1, padding:"5px 0", borderRadius:6, border:"1px solid #d1fae5", background:"white", color:"#6b7280", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
                          <button onClick={()=>{ const val=document.getElementById("startDateInput").value; if(val) updateStartDate(selectedBatch.id,val); }}
                            style={{ flex:1, padding:"5px 0", borderRadius:6, border:"none", background:"#15803d", color:"white", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>保存</button>
                        </div>
                      </div>
                    ):(
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{formatJP(new Date(selectedBatch.startDate))}</div>
                        {selectedBatch.startDateEditedBy&&<div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>編集：{selectedBatch.startDateEditedBy}</div>}
                      </div>
                    )}
                  </div>
                  <div style={{ background:"#f8fafc", borderRadius:8, padding:"8px 12px" }}>
                    <div style={{ fontSize:11, color:"#94a3b8", marginBottom:2 }}>登録者</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{selectedBatch.createdBy}</div>
                  </div>
                  <div style={{ background:tc.light, border:`1px solid ${tc.border}`, borderRadius:8, padding:"8px 12px" }}>
                    <div style={{ fontSize:11, color:"#94a3b8", marginBottom:2 }}>仕込みヤード</div>
                    <div style={{ fontSize:13, fontWeight:700, color:tc.text }}>{selectedBatch.startYard||"未設定"}</div>
                  </div>
                  <div style={{ background:tc.light, border:`1px solid ${tc.border}`, borderRadius:8, padding:"8px 12px" }}>
                    <div style={{ fontSize:11, color:"#94a3b8", marginBottom:2 }}>📍 現在のヤード</div>
                    <div style={{ fontSize:13, fontWeight:700, color:tc.text }}>{selectedBatch.currentYard||"未設定"}</div>
                  </div>
                </div>
                {selectedBatch.note&&<div style={{ marginTop:10, fontSize:12, color:"#94a3b8" }}>📝 {selectedBatch.note}</div>}
              </div>

              {(selectedBatch.yardHistory||[]).length>0&&(
                <div style={{ background:"white", borderRadius:12, padding:14, marginBottom:12, border:"1.5px solid #d1fae5" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8 }}>📍 ヤード移動履歴</div>
                  <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:4 }}>
                    <span style={{ fontSize:12, padding:"4px 10px", background:"#f8fafc", borderRadius:6, color:"#374151", fontWeight:600 }}>{selectedBatch.startYard}</span>
                    {(selectedBatch.yardHistory||[]).map((h,i)=>(
                      <div key={i} style={{ display:"flex", alignItems:"center" }}>
                        <span style={{ fontSize:10, color:"#94a3b8", margin:"0 4px" }}>→ 切{h.turnIndex+1}</span>
                        <span style={{ fontSize:12, padding:"4px 10px", background:tc.bg, borderRadius:6, color:tc.text, fontWeight:700 }}>{h.toYard}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 切り返しスケジュール */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#374151" }}>切り返しスケジュール</div>
              </div>
              <div style={{ fontSize:12, color:"#6b7280", marginBottom:10 }}>未実施をタップ → 実施記録 ／ 実施済をタップ → 取り消し</div>

              {turnings.map((t,i)=>{
                const isDone=t.done, diff=getDiff(t.date);
                const sk=isDone?"done":getStatus(t.date), s=STATUS[sk];
                const actualNote=(selectedBatch.actualNotes||{})[i];
                const actualTemp=(selectedBatch.actualTemps||{})[i];
                const actualWater=(selectedBatch.actualWaters||{})[i];
                const yardEntry=(selectedBatch.yardHistory||[]).find(h=>h.turnIndex===i);
                const isEditingDate = editingScheduledDate?.batchId===selectedBatch.id && editingScheduledDate?.turnIndex===i;
                return (
                  <div key={i} style={{ background:s.bg, border:`1.5px solid ${s.border}`, borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", cursor:"pointer" }}
                      onClick={()=>{
                        if(isEditingDate) return;
                        if(isDone){ undoTurning(selectedBatch.id,i); }
                        else { setRecordDate(toDateStr(t.scheduledDate)); setRecordYard(selectedBatch.currentYard||""); setRecordModal({ batchId:selectedBatch.id, turnIndex:i, scheduledDate:t.scheduledDate, lot:selectedBatch.lot, currentYard:selectedBatch.currentYard, label:t.label }); }
                      }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <span style={{ fontWeight:700, fontSize:13, color:s.text }}>切り返し{t.label}</span>
                          {isDone&&<span style={{ background:"#15803d", color:"white", borderRadius:5, padding:"1px 7px", fontSize:11, fontWeight:700 }}>✓ 実施済</span>}
                          {!isDone&&sk==="today"&&<span style={{ background:"#f59e0b", color:"white", borderRadius:5, padding:"1px 7px", fontSize:11, fontWeight:700 }}>本日！</span>}
                          {(selectedBatch.customDates||{})[i]&&<span style={{ background:"#f0f9ff", color:"#0369a1", borderRadius:5, padding:"1px 7px", fontSize:11, fontWeight:700 }}>📅 日程変更済</span>}
                        </div>
                        {t.note&&<div style={{ fontSize:11, color:s.text, opacity:0.8, marginTop:2 }}>💧 {t.note}</div>}
                        {isDone&&(actualTemp||(actualWater!==undefined&&actualWater!==null))&&(
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4, flexWrap:"wrap" }}>
                            {actualTemp&&<span style={{ fontSize:12, fontWeight:700, background:Number(actualTemp)>=55?"#dcfce7":"#fff7ed", color:Number(actualTemp)>=55?"#15803d":"#9a3412", border:`1px solid ${Number(actualTemp)>=55?"#86efac":"#fb923c"}`, borderRadius:6, padding:"2px 8px" }}>🌡️ {actualTemp}℃</span>}
                            {actualWater===true&&<span style={{ fontSize:12, fontWeight:700, background:"#eff6ff", color:"#1d4ed8", border:"1px solid #93c5fd", borderRadius:6, padding:"2px 8px" }}>💧 加水あり</span>}
                            {actualWater===false&&<span style={{ fontSize:12, fontWeight:700, background:"#f8fafc", color:"#64748b", border:"1px solid #cbd5e1", borderRadius:6, padding:"2px 8px" }}>加水なし</span>}
                          </div>
                        )}
                        {actualNote&&<div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>📝 {actualNote}</div>}
                        {isDone&&t.delayed!==0&&<div style={{ fontSize:11, color:t.delayed>0?"#9a3412":"#166534", marginTop:2 }}>{t.delayed>0?`⚠️ ${t.delayed}日遅れ`:`✨ ${Math.abs(t.delayed)}日早め`}</div>}
                        {isDone&&yardEntry&&<div style={{ fontSize:11, color:"#15803d", marginTop:3, fontWeight:600 }}>📍 {yardEntry.fromYard} → {yardEntry.toYard}</div>}
                      </div>
                      <div style={{ textAlign:"right", marginLeft:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:s.text }}>{isDone?formatJP(new Date(t.actualDate)):formatJP(t.date)}</div>
                        {!isDone&&<div style={{ fontSize:11, color:s.tag, fontWeight:700 }}>{diff===0?"本日":diff>0?`${diff}日後`:`${Math.abs(diff)}日経過`}</div>}
                        <div style={{ fontSize:10, color:isDone?"#94a3b8":"#15803d", marginTop:3, fontWeight:600 }}>{isDone?"タップで取消":"タップして記録"}</div>
                      </div>
                    </div>
                    {/* 予定日変更ボタン（未実施のみ） */}
                    {!isDone&&!selectedBatch.done&&(
                      <div style={{ marginTop:8, borderTop:"1px solid rgba(0,0,0,0.06)", paddingTop:8 }}>
                        {isEditingDate ? (
                          <div onClick={e=>e.stopPropagation()} style={{ display:"flex", gap:8, alignItems:"center" }}>
                            <input type="date" defaultValue={toDateStr(t.scheduledDate)}
                              id={`scheduledDate_${i}`}
                              style={{ flex:1, padding:"5px 8px", borderRadius:6, border:"1.5px solid #15803d", fontSize:13, fontFamily:"inherit", outline:"none" }}/>
                            <button onClick={()=>{
                              const val=document.getElementById(`scheduledDate_${i}`).value;
                              if(val) updateScheduledDate(selectedBatch.id,i,val);
                            }} style={{ padding:"5px 12px", borderRadius:6, border:"none", background:"#15803d", color:"white", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>保存</button>
                            <button onClick={()=>setEditingScheduledDate(null)} style={{ padding:"5px 12px", borderRadius:6, border:"1px solid #d1fae5", background:"white", color:"#6b7280", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
                          </div>
                        ) : (
                          <button onClick={e=>{ e.stopPropagation(); setEditingScheduledDate({batchId:selectedBatch.id,turnIndex:i}); }}
                            style={{ fontSize:11, color:"#6b7280", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                            📅 予定日を変更する
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ marginTop:12, padding:14, background:"#fffbeb", borderRadius:10, border:"1px dashed #fbbf24", fontSize:12, color:"#92400e" }}>
                <strong>加水ルール：</strong>55℃を下回った時点で加水をやめる。迷ったら山﨑に確認。
              </div>
              {!selectedBatch.done&&(
                <button onClick={()=>markDone(selectedBatch.id)} disabled={saving}
                  style={{ width:"100%", marginTop:16, padding:14, borderRadius:12, border:"2px solid #15803d", background:"white", color:"#15803d", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  ✅ 堆肥完成・完了にする
                </button>
              )}
              <button onClick={()=>deleteBatch(selectedBatch.id)} disabled={saving}
                style={{ width:"100%", marginTop:8, padding:12, borderRadius:12, border:"2px solid #fca5a5", background:"white", color:"#dc2626", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                🗑 削除する
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
