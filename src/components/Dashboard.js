import React, { useState, useEffect, Fragment, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { Dialog, Transition, Popover } from '@headlessui/react';
import { 
  UserGroupIcon, 
  BanknotesIcon, 
  EnvelopeIcon, 
  ArrowRightOnRectangleIcon, 
  PlusIcon, 
  InformationCircleIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  HomeIcon,
  WalletIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BellIcon,
  UserIcon,
  CalculatorIcon,
  BackspaceIcon,
  Cog6ToothIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

// Utility for class merging
const cn = (...classes) => classes.filter(Boolean).join(' ');

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const token = localStorage.getItem('token');

  const API = axios.create({
    baseURL: 'https://splitappbend.onrender.com/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  // --- STATES ---
  const [loading, setLoading] = useState(true);
  
  // Data
  const [oweList, setOweList] = useState([]);
  const [owedList, setOwedList] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [globalHistory, setGlobalHistory] = useState([]);
  
  // View States
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupHistory, setGroupHistory] = useState([]);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);
  
  // Using Ref for activeGroup to access inside Interval without resetting it
  const activeGroupRef = useRef(activeGroup);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);

  // Modals
  const [isCreateGroupOpen, setCreateGroupOpen] = useState(false);
  const [isExpenseOpen, setExpenseOpen] = useState(false);
  const [isSettleOpen, setSettleOpen] = useState(false);
  const [isInboxOpen, setInboxOpen] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [isBalancesOpen, setBalancesOpen] = useState(false);
  const [isCalculatorOpen, setCalculatorOpen] = useState(false);
  const [isGroupSettingsOpen, setGroupSettingsOpen] = useState(false);

  // Forms
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  
  // Expense Form
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [splitType, setSplitType] = useState('EQUAL');
  const [groupMembers, setGroupMembers] = useState([]);

  // Settle Form
  const [settleReceiver, setSettleReceiver] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [maxSettleAmount, setMaxSettleAmount] = useState(0);

  // Calculator State
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState('');

  // --- DATA FETCHING ENGINE (AUTO-REFRESH) ---
  
  // 1. Core Fetch Function (Silent)
  const refreshData = async () => {
    if (!user) return;
    try {
      const [balanceRes, groupsRes, notifRes] = await Promise.all([
        API.get(`/expenses/balance/${user.id}`),
        API.get(`/groups/user/${user.id}`),
        API.get(`/groups/notifications/${user.id}`)
      ]);
      setOweList(balanceRes.data.oweList);
      setOwedList(balanceRes.data.owedList);
      setMyGroups(groupsRes.data);
      setNotifications(notifRes.data);

      // If inside a group, refresh its history too
      if (activeGroupRef.current) {
         const histRes = await API.get(`/expenses/group/${activeGroupRef.current._id}`);
         setGroupHistory(histRes.data);
      }
    } catch (err) {
      console.error("Auto-refresh failed", err);
    }
  };

  // 2. Initial Load
  useEffect(() => {
    if (!user) { navigate('/'); return; }
    const init = async () => {
        setLoading(true);
        await refreshData();
        setLoading(false);
    };
    init();

    // 3. Set Interval for Auto-Refresh (Every 3 Seconds)
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchGlobalHistory = async () => {
    try {
      const res = await API.get(`/expenses/history/${user.id}`);
      setGlobalHistory(res.data);
      setHistoryOpen(true);
    } catch (err) { toast.error("Failed to load history"); }
  };

  const totalYouOwe = oweList.reduce((acc, item) => acc + parseFloat(item.amount || 0), 0).toFixed(2);
  const totalYouAreOwed = owedList.reduce((acc, item) => acc + parseFloat(item.amount || 0), 0).toFixed(2);

  const relevantHistory = globalHistory.filter(exp => {
    return exp.payer._id === user.id || exp.splits.some(s => s.user && s.user._id === user.id);
  });

  const sendNotification = async (targetUserId, message) => {
    try {
      await API.post('/groups/notifications/create', {
        userId: targetUserId,
        message: message,
        type: 'INFO', 
        senderId: user.id
      });
      refreshData(); // Immediate refresh after sending
    } catch (err) { console.warn("Notif error", err); }
  };

  // --- ACTIONS ---
  const handleGroupClick = async (group) => {
    setActiveGroup(group);
    setExpandedExpenseId(null);
    try {
      const res = await API.get(`/expenses/group/${group._id}`);
      setGroupHistory(res.data);
    } catch (err) { console.error(err); }
  };

  const submitCreateGroup = async () => {
    if(!groupName) return toast.warning("Group name required");
    try {
      await API.post('/groups/create', { name: groupName, memberIds: selectedUsers.map(u => u._id), creatorId: user.id });
      toast.success(`Group "${groupName}" created!`);
      setCreateGroupOpen(false); setGroupName(''); setSelectedUsers([]); 
      refreshData(); // Force Update
    } catch (err) { toast.error("Failed to create group"); }
  };

  const handleAddMemberToGroup = async (newMember) => {
    try {
        await API.put('/groups/add-member', { groupId: activeGroup._id, memberId: newMember._id, adminId: user.id });
        toast.success(`Invite sent to ${newMember.username}!`);
        setSearchQuery(''); setSearchResults([]);
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const handleRemoveMemberFromGroup = async (memberId) => {
    if(!window.confirm("Remove this member?")) return;
    try {
        const res = await API.put('/groups/remove-member', { groupId: activeGroup._id, memberId: memberId, adminId: user.id });
        setActiveGroup(res.data);
        toast.success("Member removed");
        refreshData();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const handleExpenseSubmit = async () => {
    if (!expenseAmount || !expenseDesc) return toast.warning("Fill fields");
    const totalAmount = parseFloat(expenseAmount);
    if (isNaN(totalAmount) || totalAmount <= 0) return toast.warning("Invalid Amount");

    let finalSplits = [];
    let involvedUserIds = [];

    if (splitType === 'EQUAL') {
      const activeMembers = groupMembers.filter(m => m.isChecked);
      if(activeMembers.length === 0) return toast.warning("Select members");
      const share = totalAmount / activeMembers.length;
      finalSplits = activeMembers.map(m => ({ userId: m.userId, amount: share }));
      involvedUserIds = activeMembers.map(m => m.userId);
    } else if (splitType === 'PERCENTAGE') {
      finalSplits = groupMembers.map(m => ({ userId: m.userId, amount: (totalAmount * parseFloat(m.value || 0)) / 100, percent: parseFloat(m.value || 0) }));
      involvedUserIds = groupMembers.filter(m => parseFloat(m.value) > 0).map(m => m.userId);
    } else {
      finalSplits = groupMembers.map(m => ({ userId: m.userId, amount: parseFloat(m.value || 0) }));
      involvedUserIds = groupMembers.filter(m => parseFloat(m.value) > 0).map(m => m.userId);
    }

    try {
      await API.post('/expenses/add', {
        description: expenseDesc, amount: totalAmount, payer: user.id, group: activeGroup._id, splitType, splitData: finalSplits
      });
      
      const notifPromises = involvedUserIds
        .filter(id => id !== user.id)
        .map(id => sendNotification(id, `${user.username} added expense: ${expenseDesc} (₹${totalAmount})`));
      await Promise.allSettled(notifPromises);

      toast.success("Expense added");
      setExpenseOpen(false); setExpenseAmount(''); setExpenseDesc('');
      refreshData(); // Force Update
    } catch (err) { toast.error("Failed to add"); }
  };

  const handleSettleSubmit = async () => {
    const amount = parseFloat(settleAmount);
    if(!settleReceiver || amount <= 0) return toast.warning("Invalid details");
    if(amount > maxSettleAmount) return toast.error(`Max amount is ₹${maxSettleAmount}`);

    try {
      await API.post('/expenses/settle', { payer: user.id, receiver: settleReceiver, amount: amount, group: activeGroup._id });
      await sendNotification(settleReceiver, `${user.username} settled ₹${amount}`);
      toast.success("Payment recorded");
      setSettleOpen(false);
      refreshData(); // Force Update
    } catch (err) { toast.error("Failed"); }
  };

  const handleInviteResponse = async (id, response) => {
    try { 
        await API.post('/groups/notifications/respond', { notificationId: id, response }); 
        toast.message(response === 'ACCEPTED' ? "Joined Group!" : "Ignored");
        refreshData(); // Immediate refresh to show new group
    } catch (err) {}
  };

  // ... (Keep existing UI helpers: openExpenseModal, handleSearch, handleCalcClick, getInitials, etc.) ...
  const handleSettleChange = (receiverId) => { setSettleReceiver(receiverId); const debt = oweList.find(u => u.id === receiverId); if(debt) { setMaxSettleAmount(parseFloat(debt.amount)); setSettleAmount(debt.amount); } else { setMaxSettleAmount(0); setSettleAmount(''); } };
  const openExpenseModal = (group) => { const target = group || activeGroup || myGroups[0]; if(!target) return toast.error("Select group"); setActiveGroup(target); setGroupMembers(target.members.map(m => ({ userId: m._id, username: m.username, value: '', isChecked: true }))); setExpenseOpen(true); };
  const handleSearch = async (q) => { setSearchQuery(q); if (q.length > 1) { const res = await API.get(`/groups/search?query=${q}`); setSearchResults(res.data.filter(u => u._id !== user.id)); } else setSearchResults([]); };
  const handleCalcClick = useCallback((val) => { if (val === 'C') { setCalcInput(''); setCalcResult(''); } else if (val === 'DEL') { setCalcInput(prev => prev.toString().slice(0, -1)); } else if (val === '=') { try { const res = eval(calcInput); setCalcResult(res.toString()); setCalcInput(res.toString()); } catch { setCalcResult('Error'); } } else { setCalcInput(prev => prev + val); } }, [calcInput]);
  useEffect(() => { if (!isCalculatorOpen) return; const handleKeyDown = (e) => { const key = e.key; if (/[0-9.]/.test(key)) handleCalcClick(key); else if (['+', '-', '*', '/'].includes(key)) handleCalcClick(key); else if (key === 'Enter') { e.preventDefault(); handleCalcClick('='); } else if (key === 'Backspace') handleCalcClick('DEL'); else if (key === 'Escape' || key.toLowerCase() === 'c') handleCalcClick('C'); }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [isCalculatorOpen, handleCalcClick]);
  const getInitials = (name) => name.substring(0, 2).toUpperCase();
  const getRandomColor = (id) => { const colors = ['bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-violet-100 text-violet-600', 'bg-amber-100 text-amber-600', 'bg-rose-100 text-rose-600']; return colors[id.charCodeAt(0) % colors.length]; };
  const isAdmin = activeGroup && ((activeGroup.creator && (activeGroup.creator._id === user.id || activeGroup.creator === user.id)) || (activeGroup.members && activeGroup.members.length > 0 && activeGroup.members[0]._id === user.id));

  if(loading) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 font-medium animate-pulse">Loading...</div>;

  return (
    <div className="flex h-screen bg-[#F2F4F7] md:bg-gradient-to-br md:from-gray-100 md:to-gray-200 text-gray-900 overflow-hidden font-sans selection:bg-teal-100 relative">
      <Toaster position="top-center" richColors theme="light" />

      {/* ======================= DESKTOP VIEW ======================= */}
      <div className="hidden md:flex w-full h-full items-center justify-center p-8 pb-28">
         <div className="w-full max-w-7xl h-[85vh] bg-white rounded-[3rem] shadow-2xl shadow-gray-300/50 border border-gray-100 overflow-hidden flex relative z-10">
            {/* Left Panel */}
            <div className="w-[350px] bg-gray-50/50 flex flex-col border-r border-gray-100">
               <div className="p-6 pb-2">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-700">{getInitials(user.username)}</div>
                    <div className="overflow-hidden"><p className="text-sm font-bold text-gray-900 truncate">{user.username}</p><div className="flex gap-2 text-[10px] font-bold"><span className={totalYouOwe > 0 ? "text-red-500" : "text-gray-400"}>Owe: {totalYouOwe}</span><span className="text-gray-300">|</span><span className={totalYouAreOwed > 0 ? "text-teal-600" : "text-gray-400"}>Owed: {totalYouAreOwed}</span></div></div>
                  </div>
                  <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black text-gray-900 tracking-tight">Groups</h2><button onClick={() => setCreateGroupOpen(true)} className="p-2 bg-black text-white rounded-full hover:scale-110 transition-transform shadow-lg"><PlusIcon className="w-4 h-4"/></button></div>
                  <div className="relative mb-2"><MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input type="text" placeholder="Filter groups..." className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5 transition-all" /></div>
               </div>
               <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
                  {myGroups.map(g => (
                    <div key={g._id} onClick={() => handleGroupClick(g)} className={`group flex items-center gap-3 p-3 cursor-pointer rounded-2xl transition-all border ${activeGroup?._id === g._id ? 'bg-white border-gray-200 shadow-lg shadow-gray-100 scale-[1.02]' : 'bg-transparent border-transparent hover:bg-white hover:border-gray-100'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm transition-transform group-hover:scale-110 ${getRandomColor(g._id)}`}>{getInitials(g.name)}</div>
                      <div className="flex-1 min-w-0"><h3 className="font-bold text-gray-900 truncate text-sm">{g.name}</h3><p className="text-[10px] text-gray-500 truncate font-medium">{g.members.length} people</p></div>
                      {activeGroup?._id === g._id && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                    </div>
                  ))}
               </div>
            </div>
            {/* Right Panel */}
            <div className="flex-1 bg-white relative flex flex-col h-full overflow-hidden">
               {activeGroup ? (
                 <>
                    <div className="h-20 px-8 flex justify-between items-center border-b border-gray-50 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
                       <div className="flex items-center gap-4"><div><h1 className="text-2xl font-black text-gray-900 tracking-tight">{activeGroup.name}</h1><p className="text-xs text-gray-400 font-medium mt-1">{activeGroup.members.length} members • Created by {activeGroup.creator?.username || 'You'}</p></div><button onClick={() => setGroupSettingsOpen(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-black"><Cog6ToothIcon className="w-5 h-5"/></button></div>
                       <div className="flex gap-3"><button onClick={() => { setSettleReceiver(''); setSettleAmount(''); setSettleOpen(true); }} className="px-5 py-2.5 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 text-sm transition-all border border-gray-100">Settle Up</button><button onClick={() => openExpenseModal(activeGroup)} className="px-5 py-2.5 bg-black text-white font-bold rounded-xl hover:bg-gray-800 shadow-xl shadow-gray-200 text-sm transition-all flex items-center gap-2 hover:-translate-y-1"><PlusIcon className="w-4 h-4"/> Add Expense</button></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#fcfcfc]">
                        {groupHistory.length === 0 ? (<div className="h-full flex flex-col items-center justify-center opacity-30"><BanknotesIcon className="w-24 h-24 mb-4"/><p className="text-xl font-bold">No expenses yet</p></div>) : groupHistory.map(exp => (
                           <div key={exp._id} className={`flex w-full ${exp.description === 'Settlement' ? 'justify-center my-6' : ''}`}>
                             {exp.description === 'Settlement' ? (
                                <div className="bg-emerald-50 text-emerald-700 px-6 py-2 rounded-full text-xs font-bold border border-emerald-100 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4"/> {exp.payer.username} settled ₹{(exp.amount || 0).toFixed(2)} with {exp.splits[0]?.user?.username}</div>
                             ) : (
                               <div className="w-full bg-white rounded-3xl p-1 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-gray-200 transition-all group">
                                  <div onClick={() => setExpandedExpenseId(expandedExpenseId === exp._id ? null : exp._id)} className="p-4 flex items-center gap-4 cursor-pointer"><div className="flex flex-col items-center justify-center w-14 h-14 bg-gray-50 rounded-2xl border border-gray-100"><span className="text-lg font-black text-gray-800">{new Date(exp.createdAt).getDate()}</span><span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(exp.createdAt).toLocaleString('default', { month: 'short' })}</span></div><div className="flex-1"><h3 className="text-base font-bold text-gray-900">{exp.description}</h3><p className="text-xs text-gray-500 font-medium"><span className="text-gray-900 font-bold">{exp.payer.username}</span> paid ₹{(exp.amount || 0).toFixed(2)}</p></div><div className="pr-4"><div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${expandedExpenseId === exp._id ? 'bg-black text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>{expandedExpenseId === exp._id ? <XCircleIcon className="w-5 h-5"/> : <InformationCircleIcon className="w-5 h-5"/>}</div></div></div>
                                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedExpenseId === exp._id ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}><div className="p-4 pt-0 grid grid-cols-2 gap-2">{exp.payer._id === user.id && (<div className="col-span-2 text-xs text-center text-emerald-600 font-bold bg-emerald-50 p-1 rounded-md mb-2">You paid full ₹{(exp.amount || 0).toFixed(2)}.</div>)}{exp.splits.map((split, idx) => { const isSplitPayer = split.user?._id === exp.payer._id; return (<div key={idx} className="flex justify-between items-center text-xs bg-gray-50/80 p-2 rounded-lg"><span className="font-medium text-gray-600">{split.user ? split.user.username : 'Unknown'}</span>{isSplitPayer ? (<span className="font-bold text-emerald-600">paid self ₹{(split.amount || 0).toFixed(2)}</span>) : (<span className="font-bold text-red-500">owes ₹{(split.amount || 0).toFixed(2)}</span>)}</div>) })}</div></div>
                               </div>
                             )}
                           </div>
                        ))}
                    </div>
                 </>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40"><div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"><BanknotesIcon className="w-10 h-10 text-gray-400"/></div><h2 className="text-2xl font-black text-gray-900">Welcome back, {user.username}</h2><p className="text-gray-500 font-medium mt-2 max-w-sm">Select a group from the sidebar to view expenses.</p></div>
               )}
            </div>
         </div>
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full z-50 transition-all hover:scale-[1.01] ring-1 ring-black/5">
            <DockItem icon={<HomeIcon className="w-6 h-6"/>} label="Home" active={true} onClick={() => setActiveGroup(null)} />
            <div className="w-px h-6 bg-gray-300/50 mx-1"></div>
            <DockItem icon={<ClockIcon className="w-6 h-6"/>} label="History" onClick={fetchGlobalHistory} />
            <DockItem icon={<CalculatorIcon className="w-6 h-6"/>} label="Calculator" onClick={() => setCalculatorOpen(true)} />
            <Popover className="relative"><Popover.Button className="outline-none"><DockItem icon={<WalletIcon className="w-6 h-6"/>} label="Wallet" badge={totalYouOwe > 0 ? "!" : null} /></Popover.Button><Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-10" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-10"><Popover.Panel className="absolute bottom-16 -left-20 w-72 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-4 z-50"><h3 className="text-xs font-black text-gray-400 uppercase mb-3">Your Balances</h3><div className="space-y-2">{oweList.length > 0 && <p className="text-[10px] text-gray-400 font-bold uppercase">You Owe</p>}{oweList.map(u => (<div key={u.id} className="flex justify-between items-center p-2 bg-red-50 rounded-lg"><span className="text-xs font-bold text-gray-700">{u.username}</span><span className="text-xs font-black text-red-500">₹{u.amount}</span></div>))}{owedList.length > 0 && <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Owed to You</p>}{owedList.map(u => (<div key={u.id} className="flex justify-between items-center p-2 bg-teal-50 rounded-lg"><span className="text-xs font-bold text-gray-700">{u.username}</span><span className="text-xs font-black text-teal-600">₹{u.amount}</span></div>))}{oweList.length === 0 && owedList.length === 0 && <p className="text-xs text-center text-gray-400 italic">All settled up!</p>}</div></Popover.Panel></Transition></Popover>
            <DockItem icon={<EnvelopeIcon className="w-6 h-6"/>} label="Inbox" badge={notifications.length > 0 ? notifications.length : null} onClick={() => setInboxOpen(true)} />
            <div className="w-px h-6 bg-gray-300/50 mx-1"></div>
            <DockItem icon={<ArrowRightOnRectangleIcon className="w-6 h-6"/>} label="Logout" danger={true} onClick={() => {localStorage.clear(); navigate('/')}} />
         </div>
      </div>

      {/* ======================= MOBILE VIEW ======================= */}
      <div className="md:hidden flex flex-col h-full w-full relative bg-[#F8F9FA]">
        <div className={cn("flex flex-col h-full transition-all duration-500 ease-in-out", activeGroup ? 'opacity-0 pointer-events-none translate-x-[-20%]' : 'opacity-100 translate-x-0')}>
            <div className="p-6 pb-2 pt-8">
               <div className="flex justify-between items-center mb-6"><div><h1 className="text-3xl font-black text-gray-900 tracking-tighter">Hello,</h1><h1 className="text-3xl font-black text-gray-400 tracking-tighter -mt-2">{user.username}</h1></div><button onClick={() => setInboxOpen(true)} className="relative p-3 bg-white rounded-2xl shadow-sm border border-gray-100"><BellIcon className="w-6 h-6 text-gray-700"/>{notifications.length > 0 && <span className="absolute top-2 right-3 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>}</button></div>
               <div onClick={() => setBalancesOpen(true)} className="w-full bg-black text-white p-6 rounded-[2rem] shadow-xl shadow-gray-200 mb-6 relative overflow-hidden cursor-pointer active:scale-95 transition-transform"><div className="absolute top-0 right-0 w-32 h-32 bg-gray-800 rounded-full mix-blend-overlay filter blur-2xl -mr-10 -mt-10"></div><div className="absolute bottom-0 left-0 w-24 h-24 bg-gray-700 rounded-full mix-blend-overlay filter blur-xl -ml-10 -mb-10"></div><div className="relative z-10 flex flex-col gap-6"><div className="flex justify-between items-start"><WalletIcon className="w-8 h-8 text-white/80"/><span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold tracking-widest uppercase flex items-center gap-1">Total Balance <ChevronDownIcon className="w-3 h-3"/></span></div><div className="flex gap-8"><div><p className="text-xs text-white/60 font-medium mb-1">You Owe</p><p className="text-2xl font-bold tracking-tight">₹{totalYouOwe}</p></div><div className="w-px bg-white/20 h-full"></div><div><p className="text-xs text-white/60 font-medium mb-1">Owed to You</p><p className="text-2xl font-bold tracking-tight text-emerald-400">₹{totalYouAreOwed}</p></div></div></div></div>
               <div className="relative z-10"><MagnifyingGlassIcon className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search your groups..." className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl text-sm font-bold shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all placeholder:font-medium placeholder:text-gray-400" /></div>
            </div>
            <div className="flex-1 overflow-y-auto pb-32 px-6">
               <div className="flex justify-between items-end mb-4"><h2 className="text-lg font-black text-gray-900">Your Groups</h2><span className="text-xs font-bold text-gray-400 mb-1">{myGroups.length} Active</span></div>
               <div className="space-y-4">{myGroups.map(g => (<div key={g._id} onClick={() => handleGroupClick(g)} className="w-full bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-center gap-4 active:scale-95 transition-transform duration-200"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shadow-inner ${getRandomColor(g._id)}`}>{getInitials(g.name)}</div><div className="flex-1"><h3 className="text-base font-bold text-gray-900 leading-tight">{g.name}</h3><p className="text-xs text-gray-500 font-medium mt-1">{g.members.length} Members</p></div><div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center"><ChevronDownIcon className="w-4 h-4 text-gray-400 -rotate-90"/></div></div>))}<button onClick={() => setCreateGroupOpen(true)} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-[1.5rem] text-gray-400 font-bold text-sm hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-2"><PlusIcon className="w-5 h-5"/> Create New Group</button></div>
            </div>
        </div>
        <div className={cn("fixed inset-0 z-40 bg-[#F8F9FA] flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]", activeGroup ? "translate-x-0" : "translate-x-full")}>
            {activeGroup && (<><div className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-[#F8F9FA]/80 backdrop-blur-xl z-50 border-b border-gray-200/50"><button onClick={() => setActiveGroup(null)} className="w-10 h-10 -ml-2 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm active:scale-90 transition-transform"><ArrowLeftIcon className="w-5 h-5 text-gray-700"/></button><div className="text-center flex flex-col items-center" onClick={() => setGroupSettingsOpen(true)}><h2 className="text-lg font-black text-gray-900 leading-none flex items-center gap-2">{activeGroup.name} <Cog6ToothIcon className="w-4 h-4 text-gray-400"/></h2><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Expenses</p></div><button onClick={() => openExpenseModal(activeGroup)} className="w-10 h-10 -mr-2 rounded-full bg-black text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"><PlusIcon className="w-5 h-5"/></button></div><div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">{groupHistory.length === 0 ? (<div className="flex flex-col items-center justify-center h-[60vh] opacity-50"><BanknotesIcon className="w-16 h-16 text-gray-300 mb-4"/><p className="font-bold text-gray-400">Start adding expenses</p></div>) : (<div className="space-y-5"><div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center mb-6"><div><p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Ready to clear debts?</p><p className="text-[10px] text-emerald-600 font-medium">Settle balances instantly.</p></div><button onClick={() => { setSettleReceiver(''); setSettleAmount(''); setSettleOpen(true); }} className="px-4 py-2 bg-white text-emerald-700 text-xs font-bold rounded-xl shadow-sm">Settle Up</button></div>{groupHistory.map((exp, idx) => (<div key={exp._id} className={`flex flex-col ${exp.description === 'Settlement' ? 'items-center my-8' : ''}`}>{exp.description === 'Settlement' ? (<span className="px-4 py-1.5 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500 flex items-center gap-2 border border-gray-200"><CheckCircleIcon className="w-3 h-3 text-emerald-500"/> {exp.payer.username} paid ₹{exp.amount}</span>) : (<div className="relative group">{(idx === 0 || new Date(groupHistory[idx-1].createdAt).getDate() !== new Date(exp.createdAt).getDate()) && (<p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3 ml-2">{new Date(exp.createdAt).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric'})}</p>)}<div onClick={() => setExpandedExpenseId(expandedExpenseId === exp._id ? null : exp._id)} className={`relative bg-white p-5 rounded-[1.5rem] border transition-all duration-300 ${expandedExpenseId === exp._id ? 'border-gray-300 shadow-lg scale-[1.02] z-10' : 'border-gray-100 shadow-sm'}`}><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${exp.payer._id === user.id ? 'bg-black' : 'bg-gray-300'}`}>{getInitials(exp.payer.username)}</div><div><h3 className="text-sm font-bold text-gray-900">{exp.description}</h3><p className="text-[10px] text-gray-500 font-medium">Paid by <span className="text-gray-900">{exp.payer.username}</span></p></div></div><div className="text-right"><p className="text-sm font-black text-gray-900">₹{exp.amount.toFixed(2)}</p></div></div>{expandedExpenseId === exp._id && (<div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">{exp.payer._id === user.id && (<p className="text-[10px] text-emerald-600 font-bold mb-2 text-center bg-emerald-50 p-1 rounded">You paid full ₹{(exp.amount || 0).toFixed(2)}.</p>)}<p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Split Details</p><div className="space-y-2">{exp.splits.map((s, i) => { const isSplitPayer = s.user?._id === exp.payer._id; return (<div key={i} className="flex justify-between text-xs"><span className="font-medium text-gray-600">{s.user?.username}</span>{isSplitPayer ? (<span className="font-bold text-emerald-600">paid self ₹{(s.amount || 0).toFixed(2)}</span>) : (<span className="font-bold text-red-500">owes ₹{(s.amount || 0).toFixed(2)}</span>)}</div>); })}</div></div>)}</div></div>)}</div>))}</div>)}</div></>)}
        </div>
        <div className={cn("fixed bottom-6 left-6 right-6 z-50 transition-transform duration-500", activeGroup ? "translate-y-[200%]" : "translate-y-0")}>
           <div className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] rounded-[2rem] p-2 flex justify-between items-center px-6 ring-1 ring-black/5">
               <button onClick={() => setActiveGroup(null)} className="flex flex-col items-center gap-1 p-2 text-black"><HomeIcon className="w-6 h-6 stroke-[2.5]"/><span className="text-[9px] font-bold">Home</span></button>
               <button onClick={fetchGlobalHistory} className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-black transition-colors"><ClockIcon className="w-6 h-6 stroke-[2.5]"/><span className="text-[9px] font-bold">History</span></button>
               <button onClick={() => setCreateGroupOpen(true)} className="-mt-12 bg-black text-white p-4 rounded-full shadow-xl shadow-gray-400/50 border-[6px] border-[#F8F9FA] active:scale-90 transition-transform"><PlusIcon className="w-6 h-6"/></button>
               <button onClick={() => setCalculatorOpen(true)} className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-black transition-colors"><CalculatorIcon className="w-6 h-6 stroke-[2.5]"/><span className="text-[9px] font-bold">Calc</span></button>
               <button onClick={() => setInboxOpen(true)} className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-black transition-colors"><EnvelopeIcon className="w-6 h-6 stroke-[2.5]"/><span className="text-[9px] font-bold">Inbox</span></button>
           </div>
        </div>
      </div>

      {/* ==================== MODALS ==================== */}
      <Modal isOpen={isGroupSettingsOpen} onClose={() => setGroupSettingsOpen(false)} title="Group Settings">{activeGroup && (<div className="space-y-6"><div><h3 className="text-sm font-black text-gray-900 mb-2">Members</h3><div className="max-h-48 overflow-y-auto space-y-2">{activeGroup.members.map(m => (<div key={m._id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{getInitials(m.username)}</div><span className="text-sm font-bold text-gray-700">{m.username} {m._id === user.id && "(You)"}</span></div>{isAdmin && m._id !== user.id && (<button onClick={() => handleRemoveMemberFromGroup(m._id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4"/></button>)}</div>))}</div></div>{isAdmin && (<div className="border-t border-gray-100 pt-4 pb-2"><h3 className="text-sm font-black text-gray-900 mb-2">Add New Member</h3><div className="relative"><input className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black" placeholder="Search username..." value={searchQuery} onChange={e => handleSearch(e.target.value)} />{searchResults.length > 0 && (<div className="w-full mt-3 bg-white shadow-sm rounded-xl max-h-60 overflow-y-auto border border-gray-100 p-1 relative z-10 custom-scrollbar">{searchResults.map(u => (<div key={u._id} onClick={() => handleAddMemberToGroup(u)} className="p-2 hover:bg-gray-50 rounded-lg cursor-pointer text-sm font-bold text-gray-700 flex justify-between items-center">{u.username}<PlusIcon className="w-4 h-4"/></div>))}</div>)}</div></div>)}</div>)}</Modal>
      <Modal isOpen={isCalculatorOpen} onClose={() => setCalculatorOpen(false)} title="Calculator"><div className="bg-gray-100 p-4 rounded-2xl border border-gray-200"><div className="bg-white p-4 rounded-xl text-right mb-4 shadow-inner border border-gray-100"><div className="text-xs text-gray-400 h-4 font-bold">{calcResult}</div><div className="text-3xl font-black text-gray-900 tracking-wider h-10 overflow-hidden">{calcInput || '0'}</div></div><div className="grid grid-cols-4 gap-2">{['C', '(', ')', '/'].map(btn => (<button key={btn} onClick={() => handleCalcClick(btn)} className="p-4 bg-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-300 active:scale-95 transition-all">{btn}</button>))}{['7', '8', '9', '*'].map(btn => (<button key={btn} onClick={() => handleCalcClick(btn)} className={`p-4 rounded-xl font-bold active:scale-95 transition-all ${['*'].includes(btn) ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-900 shadow-sm'}`}>{btn}</button>))}{['4', '5', '6', '-'].map(btn => (<button key={btn} onClick={() => handleCalcClick(btn)} className={`p-4 rounded-xl font-bold active:scale-95 transition-all ${['-'].includes(btn) ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-900 shadow-sm'}`}>{btn}</button>))}{['1', '2', '3', '+'].map(btn => (<button key={btn} onClick={() => handleCalcClick(btn)} className={`p-4 rounded-xl font-bold active:scale-95 transition-all ${['+'].includes(btn) ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-900 shadow-sm'}`}>{btn}</button>))}<button onClick={() => handleCalcClick('0')} className="col-span-2 p-4 bg-white rounded-xl font-bold text-gray-900 shadow-sm active:scale-95 transition-all">0</button><button onClick={() => handleCalcClick('.')} className="p-4 bg-white rounded-xl font-bold text-gray-900 shadow-sm active:scale-95 transition-all">.</button><button onClick={() => handleCalcClick('=')} className="p-4 bg-black text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all">=</button><button onClick={() => handleCalcClick('DEL')} className="col-span-4 mt-2 p-3 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 flex justify-center items-center gap-2"><BackspaceIcon className="w-5 h-5"/> Backspace</button></div></div></Modal>
      <Modal isOpen={isBalancesOpen} onClose={() => setBalancesOpen(false)} title="My Debts"><div className="mt-2 space-y-6"><div><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">You Owe</h4>{oweList.length === 0 ? <p className="text-sm text-gray-400 italic">You don't owe anyone.</p> : (<div className="space-y-3">{oweList.map(u => (<div key={u.id} className="flex justify-between items-center bg-red-50 p-3 rounded-xl border border-red-100"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold">{getInitials(u.username)}</div><span className="font-bold text-gray-800">{u.username}</span></div><span className="font-black text-red-500">₹{u.amount}</span></div>))}</div>)}</div><div><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Owed To You</h4>{owedList.length === 0 ? <p className="text-sm text-gray-400 italic">No one owes you.</p> : (<div className="space-y-3">{owedList.map(u => (<div key={u.id} className="flex justify-between items-center bg-teal-50 p-3 rounded-xl border border-teal-100"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-xs font-bold">{getInitials(u.username)}</div><span className="font-bold text-gray-800">{u.username}</span></div><span className="font-black text-teal-600">₹{u.amount}</span></div>))}</div>)}</div></div></Modal>
      <Modal isOpen={isCreateGroupOpen} onClose={() => setCreateGroupOpen(false)} title="New Group"><div className="mt-4 space-y-4"><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black" placeholder="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} /><div className="relative"><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black" placeholder="Add members..." value={searchQuery} onChange={e => handleSearch(e.target.value)} />{searchResults.length > 0 && <div className="absolute w-full bg-white shadow-xl rounded-xl mt-2 max-h-48 overflow-y-auto z-50 border border-gray-100 p-1">{searchResults.map(u => <div key={u._id} onClick={() => { setSelectedUsers([...selectedUsers, u]); setSearchResults([]); setSearchQuery(''); }} className="p-2 hover:bg-gray-50 rounded-lg cursor-pointer text-sm font-bold text-gray-700">{u.username}</div>)}</div>}</div><div className="flex flex-wrap gap-2 min-h-[30px]">{selectedUsers.map(u => <span key={u._id} className="bg-black text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-2">{u.username} <button onClick={() => setSelectedUsers(selectedUsers.filter(s => s._id !== u._id))}>×</button></span>)}</div><button onClick={submitCreateGroup} className="w-full bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 shadow-lg">Create Group</button></div></Modal>
      <Modal isOpen={isExpenseOpen} onClose={() => setExpenseOpen(false)} title="Add Expense"><div className="mt-4 space-y-4"><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black" placeholder="Description" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} /><div className="relative"><span className="absolute left-3 top-3 text-gray-400 font-bold">₹</span><input type="number" className="w-full p-3 pl-7 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} /></div><div className="flex bg-gray-100 p-1 rounded-xl">{['EQUAL', 'EXACT', 'PERCENTAGE'].map(t => <button key={t} onClick={() => setSplitType(t)} className={cn("flex-1 py-2 text-[10px] font-black rounded-lg transition-all", splitType === t ? "bg-white text-black shadow-sm" : "text-gray-400")}>{t}</button>)}</div><div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-2 custom-scrollbar">{groupMembers.map((m, i) => <div key={m.userId} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg"><span className="text-sm font-bold text-gray-700">{m.username}</span>{splitType === 'EQUAL' && <input type="checkbox" className="w-5 h-5 rounded text-black focus:ring-black" checked={m.isChecked} onChange={e => { const l=[...groupMembers]; l[i].isChecked=e.target.checked; setGroupMembers(l); }} />}{splitType !== 'EQUAL' && <input className="w-16 p-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-right outline-none focus:ring-1 focus:ring-black" placeholder="0" onChange={e => { const l=[...groupMembers]; l[i].value=e.target.value; setGroupMembers(l); }} />}</div>)}</div><button onClick={handleExpenseSubmit} className="w-full bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 shadow-lg">Save Expense</button></div></Modal>
      <Modal isOpen={isSettleOpen} onClose={() => setSettleOpen(false)} title="Settle Up"><div className="mt-4 space-y-4"><div><label className="text-xs font-bold text-gray-400 uppercase ml-1">Pay To</label><select className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black" onChange={e => handleSettleChange(e.target.value)} value={settleReceiver}><option value="">Select Friend...</option>{oweList.map(u => <option key={u.id} value={u.id}>{u.username} (Owe ₹{u.amount})</option>)}</select></div><div><label className="text-xs font-bold text-gray-400 uppercase ml-1">Amount</label><input type="number" max={maxSettleAmount} className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black" placeholder="₹ 0.00" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} /></div><button onClick={handleSettleSubmit} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-200">Confirm Payment</button></div></Modal>
      <Modal isOpen={isHistoryOpen} onClose={() => setHistoryOpen(false)} title="Your Activity"><div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-2">{relevantHistory.length === 0 ? <p className="text-center text-gray-400 py-4 text-sm">No recent activity for you.</p> : relevantHistory.map(exp => (<div key={exp._id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100"><div className="flex items-center gap-3"><div className={`p-2.5 rounded-xl ${exp.payer._id === user.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>{exp.description === 'Settlement' ? <CheckCircleIcon className="w-5 h-5"/> : <BanknotesIcon className="w-5 h-5"/>}</div><div><p className="text-sm font-bold text-gray-800">{exp.description}</p><p className="text-[10px] font-bold text-gray-400">{new Date(exp.createdAt).toLocaleDateString()} • {exp.group?.name || 'Group'}</p></div></div><div className="text-right">{exp.payer._id === user.id ? (<p className="text-sm font-black text-gray-900">You paid ₹{(exp.amount || 0).toFixed(2)}</p>) : (<><p className="text-[10px] font-bold text-gray-400">{exp.payer.username} paid ₹{(exp.amount || 0).toFixed(2)}</p><p className="text-sm font-black text-red-500">You owe ₹{(exp.splits.find(s => s.user && s.user._id === user.id)?.amount || 0).toFixed(2)}</p></>)}</div></div>))}</div></Modal>
      <Modal isOpen={isInboxOpen} onClose={() => setInboxOpen(false)} title="Inbox"><div className="space-y-2 max-h-80 overflow-y-auto">{notifications.length === 0 ? <p className="text-center text-gray-400 py-4 text-sm">No new notifications.</p> : notifications.map(n => (<div key={n._id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center hover:bg-gray-100 transition-colors"><p className="text-xs font-bold text-gray-600">{n.message}</p><div className="flex gap-2"><button onClick={() => handleInviteResponse(n._id, 'ACCEPTED')} className="p-1.5 bg-green-200 text-green-800 rounded-lg"><CheckCircleIcon className="w-4 h-4"/></button><button onClick={() => handleInviteResponse(n._id, 'REJECTED')} className="p-1.5 bg-red-200 text-red-800 rounded-lg"><XCircleIcon className="w-4 h-4"/></button></div></div>))}</div></Modal>
    </div>
  );
};

// ... (Helper Components)
const DockItem = ({ icon, label, onClick, active, badge, danger }) => (<div className="group relative flex flex-col items-center"><button onClick={onClick} className={cn("w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 ease-out","hover:-translate-y-2 active:scale-95",active ? "bg-black text-white shadow-lg" : "text-gray-500 hover:bg-gray-100",danger ? "hover:bg-red-50 hover:text-red-600" : "")}>{icon}{badge && (<span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">{badge}</span>)}</button><span className="absolute -top-10 scale-0 transition-all rounded bg-gray-800 p-2 text-xs text-white group-hover:scale-100 whitespace-nowrap font-bold shadow-xl">{label}</span></div>);
const Modal = ({ isOpen, onClose, title, children }) => (<Transition appear show={isOpen} as={Fragment}><Dialog as="div" className="relative z-[60]" onClose={onClose}><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-white/60 backdrop-blur-sm" /></Transition.Child><div className="fixed inset-0 overflow-y-auto"><div className="flex min-h-full items-center justify-center p-4 text-center"><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95 translate-y-10" enterTo="opacity-100 scale-100 translate-y-0" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100 translate-y-0" leaveTo="opacity-0 scale-95 translate-y-10"><Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-[32px] bg-white p-8 text-left align-middle shadow-2xl ring-1 ring-black/5 transition-all"><Dialog.Title as="h3" className="text-xl font-black leading-6 text-gray-900 flex justify-between items-center mb-6">{title}<button onClick={onClose} className="p-1.5 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"><XCircleIcon className="w-5 h-5 text-gray-400"/></button></Dialog.Title>{children}</Dialog.Panel></Transition.Child></div></div></Dialog></Transition>);

export default Dashboard;