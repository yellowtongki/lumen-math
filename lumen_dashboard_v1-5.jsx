import { useState, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from "recharts";

// ── 상수 ───────────────────────────────────────────────────
const GRADES = ["중1","중2","중3","고1","고2","고3"];
const MONTHS = ["3월","4월","5월","6월","7월","8월","9월","10월","11월","12월","1월","2월"];
const LEVELS = ["상","중","하"];
const LEVEL_COLOR = { 상:"#10b981", 중:"#f59e0b", 하:"#ef4444" };
const LEVEL_BG   = { 상:"bg-emerald-600", 중:"bg-amber-500", 하:"bg-red-500" };
const todayStr = () => new Date().toISOString().slice(0,10);

const GRADE_COLOR = {
  중1:"#3b82f6",중2:"#06b6d4",중3:"#10b981",고1:"#f59e0b",고2:"#ef4444",고3:"#8b5cf6"
};
const GRADE_BG = {
  중1:"bg-blue-500",중2:"bg-cyan-500",중3:"bg-emerald-500",
  고1:"bg-amber-500",고2:"bg-red-500",고3:"bg-violet-600"
};

// ── 완료일 계산 ────────────────────────────────────────────
function calcFinishDate(startDate, totalPages, pagesPerClass, classDaysPerWeek) {
  if (!totalPages || !pagesPerClass || !classDaysPerWeek) return null;
  const totalClasses = Math.ceil(totalPages / pagesPerClass);
  const weeks = Math.floor(totalClasses / classDaysPerWeek);
  const extraDays = (totalClasses % classDaysPerWeek) * Math.ceil(7 / classDaysPerWeek);
  const d = new Date(startDate || todayStr());
  d.setDate(d.getDate() + weeks * 7 + extraDays);
  return d.toISOString().slice(0, 10);
}

// ── 핵심: 오늘 기준 예상 진도 계산 ────────────────────────
// 시작일부터 오늘까지 경과한 수업 횟수를 계산하고
// 레벨별 pagesPerClass를 곱해 "지금쯤 있어야 할 페이지"를 반환
function calcExpectedPage(startDate, pagesPerClass, classDaysPerWeek) {
  if (!startDate || !pagesPerClass || !classDaysPerWeek) return null;
  const start = new Date(startDate);
  const today = new Date(todayStr());
  const diffDays = Math.max(0, Math.floor((today - start) / 86400000));
  const weeksElapsed = Math.floor(diffDays / 7);
  const remainDays   = diffDays % 7;
  // 주 n회 수업: 하루에 n/7 확률로 수업 있다고 단순 계산
  const classesElapsed = weeksElapsed * classDaysPerWeek
    + Math.min(remainDays, classDaysPerWeek); // 나머지 일수만큼도 반영
  return Math.round(classesElapsed * pagesPerClass);
}

// ── 진도 상태 판정 ─────────────────────────────────────────
// returns { status, behindPages, behindPct, expectedPage, actualPage, label, color, bg }
function getProgressStatus(student, book) {
  if (!book) return null;
  const ab = (student.assignedBooks||[]).find(b=>b.bookId===book.id);
  if (!ab) return null;
  const lvl = student.studentLevel||"중";
  const ppc = parseInt(book.level[lvl]?.pagesPerClass)||0;
  const total = parseInt(book.totalPages)||0;
  if (!ppc || !total) return null;

  const expectedPage = Math.min(total, calcExpectedPage(ab.startDate, ppc, student.classDaysPerWeek||2));
  const actualPage   = student.materialProgress?.[book.id]?.currentPage || 0;
  const behindPages  = Math.max(0, expectedPage - actualPage);
  const behindPct    = expectedPage > 0 ? Math.round((behindPages / expectedPage) * 100) : 0;

  // 상태 판정
  let status, label, color, bg, icon;
  if (actualPage >= total) {
    status="완료"; label="완료"; color="#10b981"; bg="bg-emerald-900/40"; icon="✅";
  } else if (behindPages === 0) {
    status="정상"; label="정상"; color="#10b981"; bg="bg-emerald-900/30"; icon="🟢";
  } else if (behindPct <= 10) {
    status="주의"; label=`${behindPages}p 지연`; color="#f59e0b"; bg="bg-amber-900/30"; icon="🟡";
  } else if (behindPct <= 25) {
    status="경고"; label=`${behindPages}p 지연`; color="#f97316"; bg="bg-orange-900/30"; icon="🟠";
  } else {
    status="위험"; label=`${behindPages}p 지연`; color="#ef4444"; bg="bg-red-900/30"; icon="🔴";
  }

  // 따라잡기 위해 필요한 추가 수업 횟수
  const catchUpClasses = ppc > 0 ? Math.ceil(behindPages / ppc) : 0;

  return { status, label, color, bg, icon, behindPages, behindPct, expectedPage, actualPage, catchUpClasses, ppc };
}

// ── 학생 전체 알림 상태 ────────────────────────────────────
function getStudentAlertLevel(student, books) {
  const sBooks = (student.assignedBooks||[]).map(ab=>books.find(b=>b.id===ab.bookId)).filter(Boolean);
  let worst = "정상";
  for (const book of sBooks) {
    const ps = getProgressStatus(student, book);
    if (!ps) continue;
    if (ps.status==="위험") return "위험";
    if (ps.status==="경고" && worst!=="위험") worst="경고";
    if (ps.status==="주의" && worst==="정상") worst="주의";
  }
  return worst;
}

const ALERT_COLOR = { 정상:"#10b981", 주의:"#f59e0b", 경고:"#f97316", 위험:"#ef4444", 완료:"#10b981" };
const ALERT_DOT   = { 정상:"bg-emerald-500", 주의:"bg-amber-400", 경고:"bg-orange-400", 위험:"bg-red-500", 완료:"bg-emerald-500" };

// ── 빈 데이터 ──────────────────────────────────────────────
const emptyBook = () => ({
  id: crypto.randomUUID(), name:"", totalPages:"", totalProblems:"", type:"현행",
  level:{ 상:{pagesPerClass:""}, 중:{pagesPerClass:""}, 하:{pagesPerClass:""} },
});

const defaultRoadmap = () =>
  Object.fromEntries(GRADES.map(g=>[g,{
    current:[""], advanced:[""],
    monthlyGoals:Object.fromEntries(MONTHS.map(m=>[m,""])),
    expectedEnd:"",
  }]));

const emptyStudent = () => ({
  id:crypto.randomUUID(), name:"", grade:"중1",
  targetUniversity:"", targetMajor:"",
  classDaysPerWeek:2, studentLevel:"중",
  assignedBooks:[], roadmap:defaultRoadmap(),
  materialProgress:{}, homeworkCheck:{}, weeklyScores:[],
  attitude:{concentration:0,participation:0,questioning:0,preparation:0,timeManagement:0},
});

// ══════════════════════════════════════════════════════════
export default function LumenApp() {
  const [books, setBooks] = useState(()=>{ try{return JSON.parse(localStorage.getItem("lumen_books")||"[]")}catch{return []} });
  const [students, setStudents] = useState(()=>{ try{return JSON.parse(localStorage.getItem("lumen_students")||"[]")}catch{return []} });
  const [selectedId, setSelectedId] = useState(null);
  const [appTab, setAppTab] = useState("class_overview");
  const [progressDate, setProgressDate] = useState(todayStr());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState("중1");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();

  const selected = students.find(s=>s.id===selectedId);

  const save = () => {
    localStorage.setItem("lumen_books", JSON.stringify(books));
    localStorage.setItem("lumen_students", JSON.stringify(students));
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  // 학생 CRUD
  const addStudent = () => {
    if(!newName.trim()) return;
    const s=emptyStudent(); s.name=newName.trim(); s.grade=newGrade;
    setStudents(p=>[...p,s]); setSelectedId(s.id);
    setNewName(""); setShowAddModal(false); setAppTab("student_settings");
  };
  const updateStudent = (field,value) =>
    setStudents(p=>p.map(s=>s.id===selectedId?{...s,[field]:value}:s));
  const deleteStudent = id => {
    if(!confirm("삭제할까요?")) return;
    setStudents(p=>p.filter(s=>s.id!==id));
    if(selectedId===id) setSelectedId(null);
  };

  // 교재 CRUD
  const addBook    = () => setBooks(p=>[...p,emptyBook()]);
  const updateBook = (id,f,v) => setBooks(p=>p.map(b=>b.id===id?{...b,[f]:v}:b));
  const updateBookLevel=(id,lv,f,v)=>setBooks(p=>p.map(b=>b.id===id?{...b,level:{...b.level,[lv]:{...b.level[lv],[f]:v}}}:b));
  const deleteBook = id => setBooks(p=>p.filter(b=>b.id!==id));

  // 교재 토글
  const toggleBook = (bookId,type) => setStudents(p=>p.map(s=>{
    if(s.id!==selectedId) return s;
    const has=s.assignedBooks.find(b=>b.bookId===bookId);
    if(has) return {...s,assignedBooks:s.assignedBooks.filter(b=>b.bookId!==bookId)};
    return {...s,assignedBooks:[...s.assignedBooks,{bookId,type,startDate:todayStr()}]};
  }));
  const updateAssignedBook=(bookId,f,v)=>setStudents(p=>p.map(s=>{
    if(s.id!==selectedId) return s;
    return {...s,assignedBooks:s.assignedBooks.map(b=>b.bookId===bookId?{...b,[f]:v}:b)};
  }));

  // 진도 입력
  const updateCurrentPage=(bookId,val)=>{
    const num=parseInt(val)||0;
    setStudents(p=>p.map(s=>{
      if(s.id!==selectedId) return s;
      const mp=s.materialProgress[bookId]||{currentPage:0,history:[]};
      const history=mp.history.filter(h=>h.date!==progressDate);
      return {...s,materialProgress:{...s.materialProgress,[bookId]:{
        currentPage:num,
        history:[...history,{date:progressDate,page:num}].sort((a,b)=>a.date.localeCompare(b.date))
      }}};
    }));
  };

  // 과제 체크
  const toggleHomework=(bookId,key)=>setStudents(p=>p.map(s=>{
    if(s.id!==selectedId) return s;
    const dd=s.homeworkCheck[progressDate]||{};
    const bd=dd[bookId]||{풀이:false,소가:false,오답:false,아하노트:false};
    return {...s,homeworkCheck:{...s.homeworkCheck,[progressDate]:{...dd,[bookId]:{...bd,[key]:!bd[key]}}}};
  }));

  // 성적
  const [scoreInput,setScoreInput]=useState("");
  const [targetInput,setTargetInput]=useState("");
  const addScore=()=>{
    const score=parseInt(scoreInput); if(isNaN(score)) return;
    const target=parseInt(targetInput)||null;
    setStudents(p=>p.map(s=>{
      if(s.id!==selectedId) return s;
      const scores=[...(s.weeklyScores||[])];
      const idx=scores.findIndex(x=>x.date===progressDate);
      const entry={date:progressDate,score,targetScore:target};
      if(idx>=0) scores[idx]=entry; else scores.push(entry);
      return {...s,weeklyScores:scores.sort((a,b)=>a.date.localeCompare(b.date))};
    }));
    setScoreInput(""); setTargetInput("");
  };

  const updateAttitude=(key,val)=>
    setStudents(p=>p.map(s=>s.id===selectedId?{...s,attitude:{...s.attitude,[key]:parseFloat(val)||0}}:s));

  // 헬퍼
  const getStudentBooks = s =>
    (s.assignedBooks||[]).map(ab=>{ const b=books.find(x=>x.id===ab.bookId); return b?{...b,assignedInfo:ab}:null; }).filter(Boolean);

  const getFinishDate = (s,book) => {
    const ab=s.assignedBooks.find(b=>b.bookId===book.id); if(!ab) return null;
    const ppc=parseInt(book.level[s.studentLevel||"중"]?.pagesPerClass)||0;
    return calcFinishDate(ab.startDate,parseInt(book.totalPages)||0,ppc,s.classDaysPerWeek||2);
  };
  const getPct=(s,bookId)=>{
    const book=books.find(b=>b.id===bookId); if(!book?.totalPages) return null;
    const mp=s.materialProgress[bookId]; if(!mp?.currentPage) return 0;
    return Math.min(100,Math.round((mp.currentPage/parseInt(book.totalPages))*100));
  };

  // JSON 불러오기
  const importJSON=e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try {
        const data=JSON.parse(ev.target.result);
        const raw=data.students||data;
        const imported=(Array.isArray(raw)?raw:[]).map(r=>{
          const s=emptyStudent(); s.id=r.id||s.id; s.name=r.name||"이름없음"; s.grade=r.grade||"중1"; return s;
        });
        setStudents(p=>{ const ids=new Set(p.map(s=>s.id)); return [...p,...imported.filter(s=>!ids.has(s.id))]; });
      } catch { alert("파일을 읽을 수 없어요."); }
    };
    reader.readAsText(file); e.target.value="";
  };

  // 알림 카운트
  const alertCounts = students.reduce((acc,s)=>{
    const lv=getStudentAlertLevel(s,books);
    if(lv==="위험") acc.danger++;
    else if(lv==="경고") acc.warning++;
    else if(lv==="주의") acc.caution++;
    return acc;
  },{danger:0,warning:0,caution:0});
  const totalAlerts = alertCounts.danger + alertCounts.warning + alertCounts.caution;

  const TABS = [
    {id:"class_overview", icon:"🏫", label:"반 현황", badge: totalAlerts>0?totalAlerts:null},
    {id:"dashboard",      icon:"📊", label:"개인 현황"},
    {id:"input",          icon:"📖", label:"오늘 진도"},
    {id:"student_settings",icon:"👤",label:"학생 설정"},
    {id:"books",          icon:"📚", label:"교재 관리"},
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 헤더 */}
      <div className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-lg">L</div>
            <div>
              <div className="font-bold text-white text-sm">루멘수학</div>
              <div className="text-xs text-gray-500">{students.length}명 관리중</div>
            </div>
          </div>
          <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setAppTab(t.id)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  appTab===t.id?"bg-blue-600 text-white shadow":"text-gray-400 hover:text-white"
                }`}>
                {t.icon} {t.label}
                {t.badge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button onClick={save} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${saved?"bg-emerald-500 text-white":"bg-blue-600 hover:bg-blue-500 text-white"}`}>
            {saved?"✓ 저장됨":"💾 저장"}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* 사이드바 */}
        <div className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-3 space-y-2 border-b border-gray-800">
            <button onClick={()=>setShowAddModal(true)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white">+ 학생 추가</button>
            <button onClick={()=>fileRef.current.click()} className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300">📂 JSON 불러오기</button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={importJSON}/>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {students.length===0 && <p className="text-gray-600 text-xs text-center py-6">학생을 추가하세요</p>}
            {students.map(s=>{
              const alertLv = getStudentAlertLevel(s,books);
              const sBooks  = getStudentBooks(s);
              return (
                <div key={s.id} onClick={()=>{ setSelectedId(s.id); if(appTab==="class_overview") setAppTab("dashboard"); }}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    selectedId===s.id?"bg-blue-600/20 border border-blue-500/40":"hover:bg-gray-800 border border-transparent"
                  }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {/* 알림 점 */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      alertLv==="위험"?"bg-red-500 animate-pulse":
                      alertLv==="경고"?"bg-orange-400":
                      alertLv==="주의"?"bg-amber-400":"bg-emerald-500"
                    }`}/>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{s.name||"이름없음"}</div>
                      <div className="text-[10px] flex items-center gap-1"
                        style={{color: alertLv==="위험"?"#ef4444":alertLv==="경고"?"#f97316":alertLv==="주의"?"#f59e0b":"#6b7280"}}>
                        {s.grade}
                        {alertLv!=="정상" && <span>· {alertLv}</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();deleteStudent(s.id);}}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 메인 */}
        <div className="flex-1 overflow-y-auto bg-gray-950">
          {appTab==="books" && (
            <BooksManager books={books} addBook={addBook} updateBook={updateBook} updateBookLevel={updateBookLevel} deleteBook={deleteBook}/>
          )}
          {appTab==="class_overview" && (
            <ClassOverview students={students} books={books} setSelectedId={setSelectedId} setAppTab={setAppTab}
              getStudentBooks={getStudentBooks} getPct={getPct} getProgressStatus={getProgressStatus}
              getStudentAlertLevel={getStudentAlertLevel} alertCounts={alertCounts}
              GRADE_BG={GRADE_BG} GRADE_COLOR={GRADE_COLOR}/>
          )}
          {appTab!=="books" && appTab!=="class_overview" && !selected && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-5xl mb-4">📚</div>
                <div className="text-gray-400 text-lg font-semibold">학생을 선택하세요</div>
              </div>
            </div>
          )}
          {appTab!=="books" && appTab!=="class_overview" && selected && (
            <>
              {appTab==="dashboard" && (
                <DashboardView student={selected} books={books}
                  getStudentBooks={getStudentBooks} getFinishDate={getFinishDate} getPct={getPct}
                  getProgressStatus={getProgressStatus}
                  gradeColor={GRADE_COLOR} gradeBg={GRADE_BG} progressDate={progressDate}/>
              )}
              {appTab==="input" && (
                <InputView student={selected} books={books}
                  progressDate={progressDate} setProgressDate={setProgressDate}
                  getStudentBooks={getStudentBooks} getPct={getPct}
                  updateCurrentPage={updateCurrentPage} toggleHomework={toggleHomework}
                  scoreInput={scoreInput} setScoreInput={setScoreInput}
                  targetInput={targetInput} setTargetInput={setTargetInput}
                  addScore={addScore} updateAttitude={updateAttitude} setAppTab={setAppTab}
                  getProgressStatus={getProgressStatus}/>
              )}
              {appTab==="student_settings" && (
                <StudentSettings student={selected} books={books}
                  updateStudent={updateStudent} toggleBook={toggleBook}
                  updateAssignedBook={updateAssignedBook}
                  getStudentBooks={getStudentBooks} getFinishDate={getFinishDate}
                  gradeColor={GRADE_COLOR} gradeBg={GRADE_BG}
                  levelColor={LEVEL_COLOR} levelBg={LEVEL_BG}/>
              )}
            </>
          )}
        </div>
      </div>

      {/* 학생 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="font-bold text-white text-lg mb-4">새 학생 추가</div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-gray-400 block mb-1">이름</label>
                <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addStudent()} placeholder="홍길동"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">학년</label>
                <select value={newGrade} onChange={e=>setNewGrade(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                  {GRADES.map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowAddModal(false)} className="flex-1 py-2 bg-gray-700 rounded-xl text-sm text-gray-300">취소</button>
              <button onClick={addStudent} disabled={!newName.trim()} className="flex-1 py-2 bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-bold text-white">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 🏫 반 현황 탭 - 핵심 신기능
// ══════════════════════════════════════════════════════════
function ClassOverview({ students, books, setSelectedId, setAppTab,
  getStudentBooks, getPct, getProgressStatus, getStudentAlertLevel, alertCounts,
  GRADE_BG, GRADE_COLOR }) {

  const [filterStatus, setFilterStatus] = useState("전체"); // 전체|위험|경고|주의|정상
  const [sortBy, setSortBy] = useState("alert"); // alert|name|grade

  // 학생별 최악 상태와 교재 목록
  const studentRows = students.map(s=>{
    const alertLv = getStudentAlertLevel(s, books);
    const sBooks  = getStudentBooks(s);
    const bookStatuses = sBooks.map(book=>({
      book,
      ps: getProgressStatus(s, book),
      pct: getPct(s, book.id)??0,
    }));
    return { s, alertLv, bookStatuses };
  });

  // 필터 + 정렬
  const ORDER = {위험:0,경고:1,주의:2,정상:3,완료:4};
  const filtered = studentRows
    .filter(r=> filterStatus==="전체" || r.alertLv===filterStatus)
    .sort((a,b)=>{
      if(sortBy==="alert") return (ORDER[a.alertLv]??5)-(ORDER[b.alertLv]??5);
      if(sortBy==="name")  return a.s.name.localeCompare(b.s.name,"ko");
      if(sortBy==="grade") return GRADES.indexOf(a.s.grade)-GRADES.indexOf(b.s.grade);
      return 0;
    });

  const STATUS_OPTS = ["전체","위험","경고","주의","정상"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 상단 요약 */}
      <div className="mb-6">
        <h2 className="text-xl font-black text-white mb-1">🏫 반 전체 현황</h2>
        <p className="text-gray-500 text-sm">교재 진도 목표 대비 실제 진행 상황 · 오늘 기준</p>
      </div>

      {/* 알림 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {lv:"위험", count:alertCounts.danger,  color:"#ef4444", bg:"bg-red-900/20",    border:"border-red-800/50",   desc:"25% 이상 지연"},
          {lv:"경고", count:alertCounts.warning, color:"#f97316", bg:"bg-orange-900/20", border:"border-orange-800/50", desc:"10~25% 지연"},
          {lv:"주의", count:alertCounts.caution, color:"#f59e0b", bg:"bg-amber-900/20",  border:"border-amber-800/50",  desc:"10% 이하 지연"},
          {lv:"정상", count:students.length-alertCounts.danger-alertCounts.warning-alertCounts.caution,
           color:"#10b981", bg:"bg-emerald-900/20", border:"border-emerald-800/50", desc:"목표 달성 중"},
        ].map(({lv,count,color,bg,border,desc})=>(
          <button key={lv} onClick={()=>setFilterStatus(filterStatus===lv?"전체":lv)}
            className={`rounded-2xl border p-4 text-left transition-all ${bg} ${border} ${filterStatus===lv?"ring-2 ring-offset-1 ring-offset-gray-950":""}`}
            style={filterStatus===lv?{ringColor:color}:{}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold" style={{color}}>{lv}</span>
              <div className="w-2 h-2 rounded-full" style={{background:color, opacity:count>0?1:0.3}}/>
            </div>
            <div className="text-3xl font-black text-white">{count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
          </button>
        ))}
      </div>

      {/* 필터 & 정렬 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {STATUS_OPTS.map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus===s?"bg-blue-600 text-white":"bg-gray-800 text-gray-400 hover:text-white"
              }`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>정렬:</span>
          {[["alert","긴급도"],["name","이름"],["grade","학년"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSortBy(v)}
              className={`px-2 py-1 rounded-lg transition-all ${sortBy===v?"text-white bg-gray-700":"hover:text-gray-300"}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 학생 목록 */}
      {filtered.length===0 ? (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
          <div className="text-4xl mb-3">
            {filterStatus==="전체"?"📚":"✅"}
          </div>
          <p className="text-gray-500 text-sm">
            {filterStatus==="전체" ? "등록된 학생이 없어요" : `${filterStatus} 상태의 학생이 없어요`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({s, alertLv, bookStatuses})=>(
            <div key={s.id}
              className={`bg-gray-900 rounded-2xl border overflow-hidden transition-all ${
                alertLv==="위험"?"border-red-800/60":
                alertLv==="경고"?"border-orange-800/60":
                alertLv==="주의"?"border-amber-800/40":"border-gray-800"
              }`}>
              {/* 학생 헤더 */}
              <div className={`px-5 py-3 flex items-center justify-between ${
                alertLv==="위험"?"bg-red-900/20":
                alertLv==="경고"?"bg-orange-900/15":
                alertLv==="주의"?"bg-amber-900/10":"bg-gray-800/30"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${GRADE_BG[s.grade]} flex items-center justify-center text-white font-black text-sm`}>
                    {s.name?.[0]||"?"}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm flex items-center gap-2">
                      {s.name}
                      {alertLv!=="정상" && alertLv!=="완료" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                          style={{background:ALERT_COLOR[alertLv]+"33",color:ALERT_COLOR[alertLv]}}>
                          {alertLv}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{s.grade} · 주 {s.classDaysPerWeek||2}회</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=>{ setSelectedId(s.id); setAppTab("input"); }}
                    className="px-3 py-1.5 bg-blue-600/20 border border-blue-700/40 text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-600/30 transition-colors">
                    진도 입력
                  </button>
                  <button
                    onClick={()=>{ setSelectedId(s.id); setAppTab("dashboard"); }}
                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 transition-colors">
                    상세 보기
                  </button>
                </div>
              </div>

              {/* 교재별 상태 */}
              {bookStatuses.length===0 ? (
                <div className="px-5 py-3 text-xs text-gray-600">배정된 교재 없음</div>
              ) : (
                <div className="px-5 py-3 space-y-3">
                  {bookStatuses.map(({book,ps,pct})=>{
                    const barCol = ps ? ps.color : "#374151";
                    return (
                      <div key={book.id}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${book.type==="선행"?"bg-red-600":"bg-blue-600"}`}>
                              {book.type}
                            </span>
                            <span className="text-xs font-medium text-gray-300">{book.name||"교재 이름 없음"}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            {ps && (
                              <>
                                {/* 예상 vs 실제 */}
                                <span className="text-gray-600">
                                  예상 <span className="text-gray-400">{ps.expectedPage}p</span>
                                  {" / "}실제 <span className="text-white font-bold">{ps.actualPage}p</span>
                                </span>
                                {/* 상태 배지 */}
                                <span className="font-bold text-xs px-2 py-0.5 rounded-full"
                                  style={{background:ps.color+"22",color:ps.color}}>
                                  {ps.icon} {ps.label}
                                </span>
                                {/* 따라잡기 */}
                                {ps.behindPages>0 && (
                                  <span className="text-gray-600 text-[10px]">
                                    {ps.catchUpClasses}회 보충 필요
                                  </span>
                                )}
                              </>
                            )}
                            <span className="font-bold" style={{color:barCol}}>{pct}%</span>
                          </div>
                        </div>
                        {/* 이중 진도바: 회색=예상, 색상=실제 */}
                        <div className="relative w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                          {/* 예상 진도 (반투명) */}
                          {ps && parseInt(book.totalPages)>0 && (
                            <div className="absolute h-3 rounded-full opacity-20"
                              style={{
                                width:`${Math.min(100,Math.round((ps.expectedPage/parseInt(book.totalPages))*100))}%`,
                                background:ps.color
                              }}/>
                          )}
                          {/* 실제 진도 */}
                          <div className="h-3 rounded-full transition-all duration-700"
                            style={{width:`${pct}%`,background:`linear-gradient(90deg,${barCol}99,${barCol})`}}/>
                        </div>
                        {/* 진도바 범례 */}
                        {ps && ps.behindPages>0 && (
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-1.5 rounded-full opacity-40" style={{background:ps.color}}/>
                              <span className="text-[10px] text-gray-600">목표</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-1.5 rounded-full" style={{background:ps.color}}/>
                              <span className="text-[10px] text-gray-600">실제</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 📊 개인 대시보드 (진도 경고 포함)
// ══════════════════════════════════════════════════════════
function DashboardView({ student:s, books, getStudentBooks, getFinishDate, getPct,
  getProgressStatus, gradeColor, gradeBg, progressDate }) {

  const sBooks = getStudentBooks(s);
  const hasScores=(s.weeklyScores||[]).length>0;
  const latestScore=hasScores?s.weeklyScores[s.weeklyScores.length-1].score:null;
  const scoreChartData=(s.weeklyScores||[]).map(x=>({label:x.date.slice(5),score:x.score,target:x.targetScore||null}));
  const attitudeData=[
    {subject:"집중력",score:s.attitude?.concentration||0},
    {subject:"참여도",score:s.attitude?.participation||0},
    {subject:"질문빈도",score:s.attitude?.questioning||0},
    {subject:"준비성",score:s.attitude?.preparation||0},
    {subject:"시간관리",score:s.attitude?.timeManagement||0},
  ];

  // 진도 경고 항목
  const alerts = sBooks.map(book=>{
    const ps=getProgressStatus(s,book);
    return ps && ps.status!=="정상" && ps.status!=="완료" ? {book,ps} : null;
  }).filter(Boolean);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* 학생 헤더 */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl border border-gray-700 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${gradeBg[s.grade]} flex items-center justify-center text-white font-black text-2xl shadow-lg`}>
              {s.name?.[0]||"?"}
            </div>
            <div>
              <div className="text-2xl font-black text-white">{s.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${gradeBg[s.grade]}`}>{s.grade}</span>
                {s.targetUniversity&&<span className="text-gray-400 text-sm">🎯 {s.targetUniversity} {s.targetMajor}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-3xl font-black" style={{color:latestScore?(latestScore>=90?"#10b981":latestScore>=70?"#f59e0b":"#ef4444"):"#6b7280"}}>
                {latestScore??"—"}
              </div>
              <div className="text-xs text-gray-500">최근 성적</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-blue-400">{sBooks.length}</div>
              <div className="text-xs text-gray-500">진행 교재</div>
            </div>
          </div>
        </div>
      </div>

      {/* 진도 경고 패널 */}
      {alerts.length>0 && (
        <div className="bg-gray-900 rounded-2xl border border-red-800/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">⚠️</span>
            <h3 className="font-bold text-red-400 text-sm">진도 지연 감지 — {alerts.length}개 교재</h3>
          </div>
          <div className="space-y-3">
            {alerts.map(({book,ps})=>(
              <div key={book.id} className={`rounded-xl p-3 border ${ps.bg} border-opacity-50`}
                style={{borderColor:ps.color+"44"}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{ps.icon}</span>
                    <span className="text-sm font-semibold text-white">{book.name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{background:ps.color+"22",color:ps.color}}>{ps.status}</span>
                  </div>
                  <div className="text-right text-xs">
                    <div style={{color:ps.color}} className="font-bold">{ps.behindPages}p 뒤처짐</div>
                    <div className="text-gray-500">{ps.catchUpClasses}회 보충 필요</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  오늘 기준 예상 {ps.expectedPage}p · 실제 {ps.actualPage}p ·{" "}
                  <span style={{color:ps.color}}>{ps.behindPct}% 지연</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 교재별 진도 */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="font-bold text-white mb-4">📊 교재별 진도 현황</h3>
        {sBooks.length===0 ? (
          <p className="text-gray-600 text-sm text-center py-6">학생 설정 탭에서 교재를 선택해주세요</p>
        ) : (
          <div className="space-y-4">
            {sBooks.map(book=>{
              const pct=getPct(s,book.id)??0;
              const finishDate=getFinishDate(s,book);
              const mp=s.materialProgress[book.id];
              const ps=getProgressStatus(s,book);
              const barCol=ps?ps.color:(pct>=80?"#10b981":pct>=50?"#f59e0b":"#3b82f6");

              return (
                <div key={book.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${book.type==="선행"?"bg-red-600":"bg-blue-600"}`}>
                        {book.type}
                      </span>
                      <span className="text-sm font-semibold text-gray-200">{book.name}</span>
                      {ps && ps.status!=="정상" && ps.status!=="완료" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{background:ps.color+"22",color:ps.color}}>{ps.icon} {ps.label}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {mp?.currentPage>0&&<span className="text-gray-500">{mp.currentPage}/{book.totalPages}p</span>}
                      {finishDate&&<span className="text-emerald-400 font-bold">→ {finishDate}</span>}
                      <span className="font-bold" style={{color:barCol}}>{pct}%</span>
                    </div>
                  </div>
                  {/* 이중 바 */}
                  <div className="relative w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                    {ps && parseInt(book.totalPages)>0 && (
                      <div className="absolute h-4 rounded-full opacity-20"
                        style={{width:`${Math.min(100,Math.round((ps.expectedPage/parseInt(book.totalPages))*100))}%`,background:ps.color}}/>
                    )}
                    <div className="h-4 rounded-full transition-all duration-700"
                      style={{width:`${pct}%`,background:`linear-gradient(90deg,${barCol}99,${barCol})`}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-4">📈 목표 vs 실제 성적</h3>
          {hasScores ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scoreChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                <XAxis dataKey="label" tick={{fill:"#6b7280",fontSize:10}}/>
                <YAxis domain={[0,100]} tick={{fill:"#6b7280",fontSize:10}}/>
                <Tooltip contentStyle={{background:"#111827",border:"1px solid #374151",borderRadius:"8px"}} labelStyle={{color:"#9ca3af"}}/>
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} name="실제" dot={{fill:"#3b82f6",r:4}}/>
                <Line type="monotone" dataKey="target" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" name="목표" dot={{fill:"#f59e0b",r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">오늘 진도 탭에서 성적을 입력하세요</div>
          )}
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-4">⭐ 학습 태도</h3>
          {attitudeData.some(d=>d.score>0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={attitudeData}>
                <PolarGrid stroke="#1f2937"/>
                <PolarAngleAxis dataKey="subject" tick={{fill:"#9ca3af",fontSize:10}}/>
                <PolarRadiusAxis angle={90} domain={[0,5]} tick={{fill:"#6b7280",fontSize:9}}/>
                <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2}/>
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">오늘 진도 탭에서 태도 평가를 입력하세요</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 📖 오늘 진도 입력 (경고 배지 포함)
// ══════════════════════════════════════════════════════════
function InputView({ student:s, books, progressDate, setProgressDate,
  getStudentBooks, getPct, updateCurrentPage, toggleHomework,
  scoreInput, setScoreInput, targetInput, setTargetInput, addScore,
  updateAttitude, setAppTab, getProgressStatus }) {

  const sBooks=getStudentBooks(s);
  const HW_KEYS=["풀이","소가","오답","아하노트"];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3 bg-gray-900 rounded-2xl border border-gray-800 px-5 py-3">
        <span className="text-sm font-semibold text-gray-300">📅 날짜</span>
        <input type="date" value={progressDate} onChange={e=>setProgressDate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"/>
        <button onClick={()=>setProgressDate(new Date().toISOString().slice(0,10))}
          className="text-xs text-blue-400 border border-blue-800 px-2 py-1 rounded-lg">오늘</button>
      </div>

      {sBooks.length===0 ? (
        <div className="bg-gray-900 rounded-2xl border border-dashed border-gray-700 p-10 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 text-sm mb-3">학생 설정 탭에서 교재를 선택해주세요</p>
          <button onClick={()=>setAppTab("student_settings")} className="px-4 py-2 bg-blue-600 rounded-lg text-sm text-white font-semibold">👤 학생 설정</button>
        </div>
      ) : sBooks.map(book=>{
        const mp=s.materialProgress[book.id]||{currentPage:0,history:[]};
        const pct=getPct(s,book.id)??0;
        const hwDate=s.homeworkCheck?.[progressDate]?.[book.id]||{};
        const ps=getProgressStatus(s,book);
        const barCol=ps?ps.color:(pct>=80?"#10b981":pct>=50?"#f59e0b":"#3b82f6");
        const hwDone=HW_KEYS.filter(k=>hwDate[k]).length;
        const isAdv=book.type==="선행";

        return (
          <div key={book.id} className={`bg-gray-900 rounded-2xl border overflow-hidden ${
            ps&&ps.status==="위험"?"border-red-800/60":
            ps&&ps.status==="경고"?"border-orange-800/50":"border-gray-800"
          }`}>
            <div className={`px-4 py-3 flex items-center justify-between ${isAdv?"bg-red-950/40":"bg-blue-950/40"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${isAdv?"bg-red-600":"bg-blue-600"}`}>
                  {isAdv?"선행":"현행"}
                </span>
                <span className="text-sm font-bold text-white">{book.name}</span>
                {ps && ps.status!=="정상" && ps.status!=="완료" && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{background:ps.color+"22",color:ps.color}}>
                    {ps.icon} {ps.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{hwDone}/{HW_KEYS.length} 완료</span>
                <span className="text-sm font-black" style={{color:barCol}}>{pct}%</span>
              </div>
            </div>

            {/* 이중 진도바 */}
            <div className="relative w-full bg-gray-800 h-2">
              {ps && parseInt(book.totalPages)>0 && (
                <div className="absolute h-2 opacity-20"
                  style={{width:`${Math.min(100,Math.round((ps.expectedPage/parseInt(book.totalPages))*100))}%`,background:ps.color}}/>
              )}
              <div className="h-2 transition-all duration-500" style={{width:`${pct}%`,background:barCol}}/>
            </div>

            <div className="p-4 space-y-4">
              {/* 경고 메시지 */}
              {ps && ps.behindPages>0 && (
                <div className="rounded-xl p-3 text-xs flex items-start gap-2"
                  style={{background:ps.color+"11",borderLeft:`3px solid ${ps.color}`}}>
                  <span>{ps.icon}</span>
                  <div style={{color:ps.color}}>
                    <span className="font-bold">오늘 목표 {ps.expectedPage}p</span>
                    {" · "}현재 {ps.actualPage}p
                    {" · "}<span className="font-bold">{ps.behindPages}p 뒤처짐</span>
                    {" "}({ps.catchUpClasses}회 보충 필요)
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">전체 페이지</label>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm text-center font-mono text-gray-400">
                    {book.totalPages||"—"}p
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-emerald-400 block mb-1 font-bold">오늘 진도 (현재 p)</label>
                  <input type="number" min="0" max={book.totalPages||9999}
                    value={mp.currentPage||""}
                    onChange={e=>updateCurrentPage(book.id,e.target.value)}
                    placeholder={ps?`목표 ${ps.expectedPage}p`:"입력"}
                    className="w-full bg-gray-800 border-2 border-emerald-600 rounded-lg px-3 py-2 text-white text-center font-mono text-base font-black focus:outline-none focus:border-emerald-400"/>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-2 font-semibold">✅ 과제 체크리스트</div>
                <div className="grid grid-cols-4 gap-2">
                  {HW_KEYS.map(key=>{
                    const done=!!hwDate[key];
                    return (
                      <button key={key} onClick={()=>toggleHomework(book.id,key)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                          done?"bg-emerald-600 border-emerald-500 text-white":"bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600"
                        }`}>
                        {done?"✓ ":""}{key}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 성적 */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="font-bold text-white text-sm mb-3">📝 오늘 성적</h3>
        <div className="flex gap-2 mb-3">
          <input type="number" min="0" max="100" value={scoreInput} onChange={e=>setScoreInput(e.target.value)}
            placeholder="실제 점수" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"/>
          <input type="number" min="0" max="100" value={targetInput} onChange={e=>setTargetInput(e.target.value)}
            placeholder="목표 점수" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"/>
          <button onClick={addScore} disabled={!scoreInput} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-bold text-white">추가</button>
        </div>
        {(s.weeklyScores||[]).length>0 && (
          <div className="flex flex-wrap gap-2">
            {[...s.weeklyScores].reverse().slice(0,5).map(x=>(
              <span key={x.date} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-lg">
                {x.date.slice(5)} · <span className="text-white font-bold">{x.score}점</span>
                {x.targetScore&&<span className="text-amber-400"> /목표{x.targetScore}</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 태도 */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="font-bold text-white text-sm mb-3">⭐ 학습 태도</h3>
        <div className="space-y-3">
          {[
            {key:"concentration",label:"집중력"},{key:"participation",label:"참여도"},
            {key:"questioning",label:"질문빈도"},{key:"preparation",label:"준비성"},
            {key:"timeManagement",label:"시간관리"},
          ].map(({key,label})=>(
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-16">{label}</span>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(v=>(
                  <button key={v} onClick={()=>updateAttitude(key,v)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                      (s.attitude?.[key]||0)>=v?"bg-violet-600 text-white":"bg-gray-800 text-gray-600 hover:bg-gray-700"
                    }`}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 👤 학생 설정 (v1-4와 동일)
// ══════════════════════════════════════════════════════════
function StudentSettings({ student:s, books, updateStudent, toggleBook,
  updateAssignedBook, getStudentBooks, getFinishDate,
  gradeColor, gradeBg, levelColor, levelBg }) {
  const assignedIds=new Set(s.assignedBooks.map(b=>b.bookId));
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">기본 정보</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[{field:"name",label:"이름",ph:"홍길동"},{field:"targetUniversity",label:"목표 대학",ph:"고려대학교"},{field:"targetMajor",label:"목표 학과",ph:"생명과학부"}]
            .map(({field,label,ph})=>(
              <div key={field}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input value={s[field]||""} onChange={e=>updateStudent(field,e.target.value)} placeholder={ph}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/>
              </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 block mb-1">학년</label>
            <select value={s.grade} onChange={e=>updateStudent("grade",e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              {GRADES.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">주 수업 횟수</label>
            <select value={s.classDaysPerWeek||2} onChange={e=>updateStudent("classDaysPerWeek",parseInt(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              {[1,2,3,4,5].map(n=><option key={n} value={n}>주 {n}회</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">레벨 설정</div>
          <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">🔒 비공개</span>
        </div>
        <div className="flex gap-3">
          {LEVELS.map(lv=>(
            <button key={lv} onClick={()=>updateStudent("studentLevel",lv)}
              className={`flex-1 py-3 rounded-xl font-black text-lg transition-all border-2 ${
                s.studentLevel===lv?"text-white border-transparent shadow-lg scale-105":"text-gray-500 border-gray-700 bg-gray-800"
              }`}
              style={s.studentLevel===lv?{background:levelColor[lv],borderColor:levelColor[lv]}:{}}>
              {lv}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">교재 선택</div>
        {books.length===0 && <p className="text-gray-600 text-sm text-center py-4">📚 교재 관리 탭에서 먼저 교재를 등록해주세요</p>}
        <div className="space-y-3">
          {books.map(book=>{
            const isOn=assignedIds.has(book.id);
            const ab=s.assignedBooks.find(b=>b.bookId===book.id);
            const finishDate=isOn?getFinishDate(s,book):null;
            const lv=s.studentLevel||"중";
            const ppc=parseInt(book.level[lv]?.pagesPerClass)||0;
            return (
              <div key={book.id} className={`rounded-xl border-2 transition-all overflow-hidden ${isOn?"border-blue-500/60 bg-blue-900/10":"border-gray-700 bg-gray-800/30"}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={()=>toggleBook(book.id,book.type)}
                    className={`w-12 h-6 rounded-full transition-all flex-shrink-0 relative ${isOn?"bg-blue-600":"bg-gray-700"}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${isOn?"left-6":"left-0.5"}`}/>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{book.name||"이름 없는 교재"}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${book.type==="선행"?"bg-red-600":"bg-blue-600"}`}>{book.type}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                      {book.totalPages&&<span>{book.totalPages}p</span>}
                      {ppc>0&&isOn&&<span className="text-blue-400">· {ppc}p/회</span>}
                    </div>
                  </div>
                  {isOn&&finishDate&&(
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-emerald-400">{finishDate}</div>
                      <div className="text-[10px] text-gray-600">완료 예상</div>
                    </div>
                  )}
                </div>
                {isOn&&(
                  <div className="px-4 pb-3 flex items-center gap-3 border-t border-gray-700/50 pt-2">
                    <span className="text-xs text-gray-500">시작일</span>
                    <input type="date" value={ab?.startDate||todayStr()}
                      onChange={e=>updateAssignedBook(book.id,"startDate",e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 📚 교재 관리 (v1-4와 동일)
// ══════════════════════════════════════════════════════════
function BooksManager({ books, addBook, updateBook, updateBookLevel, deleteBook }) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-white">📚 교재 라이브러리</h2>
          <p className="text-gray-500 text-sm mt-1">교재를 등록하면 학생별로 토글로 선택할 수 있어요</p>
        </div>
        <button onClick={addBook} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white">+ 교재 추가</button>
      </div>
      {books.length===0&&(
        <div className="bg-gray-900 rounded-2xl border border-dashed border-gray-700 p-12 text-center">
          <div className="text-5xl mb-3">📖</div>
          <p className="text-gray-500 text-sm">아직 등록된 교재가 없어요</p>
          <button onClick={addBook} className="mt-4 px-5 py-2 bg-blue-600 rounded-xl text-sm text-white font-semibold">첫 교재 추가하기</button>
        </div>
      )}
      <div className="space-y-4">
        {books.map(book=>{
          const total=parseInt(book.totalPages)||0;
          return (
            <div key={book.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4 border-b border-gray-800">
                <input value={book.name} onChange={e=>updateBook(book.id,"name",e.target.value)} placeholder="교재 이름"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-semibold focus:outline-none focus:border-blue-500"/>
                <select value={book.type} onChange={e=>updateBook(book.id,"type",e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  <option>현행</option><option>선행</option>
                </select>
                <button onClick={()=>deleteBook(book.id)} className="text-gray-600 hover:text-red-400 text-sm px-2">🗑️</button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">총 페이지</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" value={book.totalPages} onChange={e=>updateBook(book.id,"totalPages",e.target.value)} placeholder="300"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 text-center font-mono"/>
                      <span className="text-gray-500 text-sm">p</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">총 문제 수</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" value={book.totalProblems} onChange={e=>updateBook(book.id,"totalProblems",e.target.value)} placeholder="1200"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 text-center font-mono"/>
                      <span className="text-gray-500 text-sm">문제</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">
                    🔒 레벨별 1회 수업 할당량 <span className="text-gray-600 font-normal">(학부모 비공개)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {LEVELS.map(lv=>{
                      const ppc=parseInt(book.level[lv]?.pagesPerClass)||0;
                      const weeksEx=ppc>0?Math.ceil(Math.ceil(total/ppc)/2):0;
                      return (
                        <div key={lv} className="bg-gray-900 rounded-xl p-3 border" style={{borderColor:LEVEL_COLOR[lv]+"44"}}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black" style={{background:LEVEL_COLOR[lv]}}>{lv}</div>
                            <span className="text-xs font-bold text-gray-300">{lv}위권</span>
                          </div>
                          <div className="flex items-center gap-1 mb-2">
                            <input type="number" min="0" value={book.level[lv]?.pagesPerClass||""}
                              onChange={e=>updateBookLevel(book.id,lv,"pagesPerClass",e.target.value)}
                              placeholder="0"
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm text-center font-mono focus:outline-none"
                              style={{borderColor:LEVEL_COLOR[lv]+"66"}}/>
                            <span className="text-gray-500 text-xs flex-shrink-0">p/회</span>
                          </div>
                          {total>0&&ppc>0&&(
                            <div className="text-center">
                              <div className="text-xs font-bold" style={{color:LEVEL_COLOR[lv]}}>약 {weeksEx}주</div>
                              <div className="text-[10px] text-gray-600">주 2회 기준</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
