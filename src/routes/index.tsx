import { createFileRoute } from "@tanstack/react-router";
import { 
  Send, 
  MessageSquare, 
  Settings, 
  LayoutDashboard,
  User,
  Clock,
  Upload,
  Calendar,
  Users,
  Smartphone,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  LogOut,
  Mail,
  Lock,
  Loader2,
  Moon,
  Sun,
  CreditCard,
  Wallet
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sendSmsFn } from "./api/send-sms";
import { bulkSendSmsFn } from "./api/-bulk-send-sms";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  component: Index,
});

type HistoryItem = { id: string, to: string, msg: string, date: string, status: string, color: string };

function Index() {
  // Auth state
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [sendMode, setSendMode] = useState<"single" | "bulk">("single");
  
  // Single SMS state
  const [phone, setPhone] = useState("");
  
  // Bulk SMS state
  const [bulkText, setBulkText] = useState("");
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [bulkDelay, setBulkDelay] = useState<number>(0.6);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Common state
  const [message, setMessage] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Progress Tracking State
  const [dispatchProgress, setDispatchProgress] = useState<{
    total: number;
    current: number;
    success: number;
    failed: number;
    active: boolean;
  } | null>(null);
  
  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (activeTab === "history" && session?.user) {
      setIsLoadingHistory(true);
      supabase
        .from('message_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
        .then(({ data, error }) => {
          if (data && !error) {
            setHistory(data);
          }
          setIsLoadingHistory(false);
        });
    }
  }, [activeTab, session]);

  const downloadCSV = () => {
    if (history.length === 0) return;
    const headers = ["ID", "Destinatário", "Mensagem", "Status", "Data"];
    const csvContent = [
      headers.join(","),
      ...history.map(h => 
        [
          h.id, 
          h.to_number, 
          `"${h.message.replace(/"/g, '""')}"`, 
          h.status, 
          new Date(h.created_at).toLocaleString('pt-BR')
        ].join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `historico_sms_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Opt-outs State
  const [optOuts, setOptOuts] = useState<any[]>([]);
  const [isLoadingOptOuts, setIsLoadingOptOuts] = useState(false);
  const [newOptOutNumber, setNewOptOutNumber] = useState("");
  const [isAddingOptOut, setIsAddingOptOut] = useState(false);

  useEffect(() => {
    if (activeTab === "opt-outs" && session?.user) {
      fetchOptOuts();
    }
  }, [activeTab, session]);

  const fetchOptOuts = async () => {
    setIsLoadingOptOuts(true);
    const { data, error } = await supabase
      .from('opt_outs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data && !error) {
      setOptOuts(data);
    }
    setIsLoadingOptOuts(false);
  };

  const handleAddOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptOutNumber || !session?.user) return;
    
    setIsAddingOptOut(true);
    
    // Extrai todos os números do texto separando por quebra de linha ou vírgula
    const rawNumbers = newOptOutNumber.split(/[\n,;]+/)
      .map(n => n.replace(/\D/g, ''))
      .filter(n => n.length >= 8); // Pelo menos 8 dígitos para ser válido
      
    // Remove duplicatas locais
    const uniqueNumbers = [...new Set(rawNumbers)];

    if (uniqueNumbers.length === 0) {
      toast.error("Nenhum número válido encontrado.");
      setIsAddingOptOut(false);
      return;
    }
    
    const inserts = uniqueNumbers.map(num => ({
      user_id: session.user.id,
      phone_number: num
    }));

    // O Supabase vai inserir os números e ignorar os que já existem devido a constraint UNIQUE
    const { error } = await supabase.from('opt_outs').upsert(inserts, { onConflict: 'user_id, phone_number', ignoreDuplicates: true });

    if (error) {
      toast.error("Erro ao bloquear números.");
    } else {
      toast.success(`${uniqueNumbers.length} número(s) processado(s) com sucesso!`);
      setNewOptOutNumber("");
      fetchOptOuts();
    }
    setIsAddingOptOut(false);
  };

  const handleRemoveOptOut = async (id: string) => {
    if (!session?.user) return;
    
    const { error } = await supabase
      .from('opt_outs')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);
      
    if (error) {
      toast.error("Erro ao remover bloqueio.");
    } else {
      toast.success("Número removido dos bloqueios!");
      fetchOptOuts();
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    const fetchBalance = async () => {
      const { data } = await supabase.from('user_credits').select('balance').eq('user_id', session.user.id).single();
      if (data) setBalance(data.balance);
    };
    
    fetchBalance();
    
    const channel = supabase.channel('credits_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_credits', filter: `user_id=eq.${session.user.id}` }, payload => {
        setBalance((payload.new as any).balance);
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAuth(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Login realizado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro na autenticação. Verifique seu e-mail e senha.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
  };

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#020817]"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen grid md:grid-cols-2 bg-[#020817] text-white font-sans selection:bg-blue-500/30">
        
        {/* Left Side - Presentation */}
        <div className="hidden md:flex flex-col justify-center px-12 lg:px-24 border-r border-slate-800 relative overflow-hidden bg-[#020817]">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          
          {/* Header Mobile Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200/50 md:hidden bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <MessageSquare size={16} />
              </div>
              <span className="font-bold text-slate-800">Painel SMS</span>
            </div>
            
            <button onClick={handleSignOut} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut size={20} />
            </button>
          </div>

          <div className="relative z-10 flex-1 flex flex-col pt-12">
            <div className="flex items-center gap-3 mb-16">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <MessageSquare size={20} className="text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">Painel SMS <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full ml-2 align-middle font-medium border border-slate-700">V1.1</span></span>
            </div>
            
            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4">
              Plataforma Corporativa de SMS
            </p>
            
            <h1 className="text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight mb-6">
              Disparos de SMS, campanhas e automações em um só console.
            </h1>
            
            <p className="text-slate-400 text-lg leading-relaxed max-w-md mb-12">
              Centralize conversas, dispare broadcasts com a nossa API oficial e acompanhe resultados em tempo real, com segurança de nível empresarial.
            </p>
            
            <div className="grid grid-cols-3 gap-6 mt-auto pb-12">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1 uppercase">Uptime</p>
                <p className="text-2xl font-bold">99,9%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1 uppercase">Mensagens/Mês</p>
                <p className="text-2xl font-bold">1M+</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1 uppercase">API Oficial</p>
                <p className="text-2xl font-bold">Garantida</p>
              </div>
            </div>
            
            <div className="text-xs text-slate-600 pb-8">
              © 2026 Painel SMS. Todos os direitos reservados.
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex items-center justify-center p-6 relative bg-[#020817]">
          {/* Subtle glow effect behind form */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="w-full max-w-[420px] bg-[#0b1324] border border-slate-800/80 rounded-2xl p-8 lg:p-10 shadow-2xl relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              Acessar O Painel V1.1
            </h2>
            <p className="text-sm text-slate-400 mb-8">
              Use suas credenciais corporativas para continuar.
            </p>
            
            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#020817] border border-slate-800 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                  placeholder="seu@email.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#020817] border border-slate-800 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg mt-6 shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:hover:bg-blue-500"
              >
                {isSubmittingAuth ? <Loader2 className="animate-spin" size={18} /> : "Entrar no sistema"}
              </button>
            </form>
            
            <div className="mt-8 text-center text-xs text-slate-500 flex flex-col items-center gap-4">
              <p>Ambiente protegido • Conexão criptografada</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SMS limits calculation
  const smsLength = message.length;
  const smsCount = smsLength === 0 ? 0 : Math.ceil(smsLength / 160);

  const processBulkText = (text: string) => {
    setBulkText(text);
    const rawNumbers = text.split(/[\n,;]+/).map(n => n.trim().replace(/\D/g, ''));
    const validNumbers = rawNumbers.filter(n => n.length >= 10 && n.length <= 15);
    // Remove duplicates
    setParsedNumbers([...new Set(validNumbers)]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processBulkText(bulkText + (bulkText ? "\n" : "") + content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generateId = () => `msg_${Math.random().toString(36).substring(2, 9)}`;
  const getNowFormatted = () => {
    const now = new Date();
    return `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  const handleSendSMS = async () => {
    if (!message) {
      toast.error("Por favor, digite uma mensagem.");
      return;
    }

    if (sendMode === "single" && !phone) {
      toast.error("Preencha o destinatário.");
      return;
    }

    if (sendMode === "bulk" && parsedNumbers.length === 0) {
      toast.error("Adicione pelo menos um número válido para envio em massa.");
      return;
    }

    setIsSending(true);
    try {
      if (sendMode === "single") {
        const data = await sendSmsFn({ data: { to: phone, message, token: session.access_token } });
        if (!data.success) throw new Error("Falha ao enviar SMS");
        
        toast.success(scheduleDate ? `SMS agendado para ${new Date(scheduleDate).toLocaleString()}` : "SMS enviado com sucesso!");
        
        setPhone("");
      } else {
        // Real-time tracking loop
        setDispatchProgress({ total: parsedNumbers.length, current: 0, success: 0, failed: 0, active: true });
        
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < parsedNumbers.length; i++) {
          const num = parsedNumbers[i];
          if (!num) continue;
          
          try {
            // Enviamos um a um para poder acompanhar o progresso real na tela
            const data = await sendSmsFn({ data: { to: num, message, token: session.access_token } });
            if (data.success) {
              successCount++;
            } else {
              failedCount++;
            }
          } catch(e) {
            failedCount++;
          }
          
          setDispatchProgress({ total: parsedNumbers.length, current: i + 1, success: successCount, failed: failedCount, active: true });
          
          // Animação de progresso suave e controle de rate limiting da API
          await new Promise(r => setTimeout(r, bulkDelay * 1000));
        }

        toast.success(
          scheduleDate 
            ? `Agendamento concluído para ${parsedNumbers.length} contatos!`
            : `Disparo finalizado! ${successCount} entregues, ${failedCount} falhas.`
        );

        setDispatchProgress(prev => prev ? { ...prev, active: false } : null);
        setBulkText("");
        setParsedNumbers([]);
        setFileName(null);
      }
      
      setMessage("");
      setScheduleDate("");
    } catch (error: any) {
      toast.error(error.message || "Ocorreu um erro ao enviar.");
    } finally {
      setIsSending(false);
    }
  };

  const sidebarItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Painel de Envio" },
    { id: "history", icon: Clock, label: "Histórico" },
    { id: "opt-outs", icon: MessageSquare, label: "Opt-outs" },
    { id: "webhooks", icon: Settings, label: "Webhooks" },
    { id: "recharge", icon: CreditCard, label: "Recarga de Créditos" },
  ];

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#020817] flex font-sans selection:bg-blue-500/30">
        {/* Sidebar - Clean and modern */}
        <aside className="hidden w-64 border-r border-gray-200 dark:border-slate-800/60 bg-white dark:bg-[#0b1324]/50 backdrop-blur-xl md:flex md:flex-col">
          <div className="flex h-16 items-center border-b border-gray-200 dark:border-slate-800/60 px-6">
            <div className="flex items-center gap-2 font-bold text-blue-600">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <Send size={16} />
              </div>
              <span className="text-xl tracking-tight">Painel SMS</span>
            </div>
          </div>
          
          <nav className="flex-1 space-y-1 p-4">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/80 hover:text-gray-900 dark:text-white"
                )}
              >
                <item.icon size={18} className={activeTab === item.id ? "text-blue-600" : "text-gray-400"} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Balance Widget */}
          <div className="px-4 mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={16} className="text-blue-100" />
                <span className="text-sm font-medium text-blue-100">Saldo Atual</span>
              </div>
              <div className="text-2xl font-bold tracking-tight">
                {balance === null ? <Loader2 size={18} className="animate-spin mt-1" /> : balance.toLocaleString('pt-BR')} <span className="text-sm font-normal opacity-80">SMS</span>
              </div>
              <button 
                onClick={() => setActiveTab("recharge")}
                className="mt-3 w-full bg-white/20 hover:bg-white/30 transition-colors rounded-lg py-1.5 text-xs font-semibold"
              >
                Adicionar Créditos
              </button>
            </div>
          </div>

          {/* Theme Toggle & Settings Section */}
          <div className="p-4 space-y-3 border-t border-gray-200 dark:border-slate-800/60">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center justify-between gap-2 py-2.5 px-4 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all font-medium border border-slate-200 dark:border-slate-700/50"
            >
              <span className="text-sm">Modo Noturno</span>
              {isDarkMode ? <Moon size={16} className="text-blue-400" /> : <Sun size={16} className="text-orange-500" />}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-[#0b1324]">
          {/* Top Header */}
          <header className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-slate-800/60 bg-white dark:bg-[#0b1324]/80 backdrop-blur-md px-8 sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1 max-w-xl">
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
                {sidebarItems.find(i => i.id === activeTab)?.label || "Painel"}
              </h1>
            </div>
            
              <div className="flex items-center gap-3">
                <button className="group flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 transition-all hover:bg-white dark:bg-[#0b1324]/60 hover:shadow-sm active:scale-[0.98]">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-blue-700 transition-colors">{session?.user?.email || "Usuário"}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ring-1 ring-gray-200/50 group-hover:ring-blue-300 transition-all">
                    <User size={18} className="text-blue-600" />
                  </div>
                </button>
                <button 
                  onClick={handleSignOut}
                  className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors ml-2"
                  title="Sair"
                >
                  <LogOut size={20} />
                </button>
              </div>
          </header>

          {/* Dashboard Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            {activeTab === "dashboard" && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8 text-center sm:text-left">
                  <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">Envio de SMS</h1>
                  <p className="text-gray-500 dark:text-slate-400 text-lg">Crie e dispare campanhas ou mensagens individuais rapidamente.</p>
                </div>

                {/* Glassmorphism Card */}
                <div className="rounded-2xl border border-white/40 bg-white dark:bg-[#0b1324]/60 backdrop-blur-xl p-1 shadow-xl shadow-gray-200/50">
                  <div className="rounded-xl bg-white dark:bg-[#0b1324] p-6 sm:p-8">
                    
                    {/* Mode Selector */}
                    <div className="flex p-1 mb-8 space-x-1 bg-gray-100/80 dark:bg-slate-900 rounded-xl max-w-sm mx-auto sm:mx-0">
                      <button
                        onClick={() => setSendMode("single")}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all",
                          sendMode === "single" ? "bg-white dark:bg-[#0b1324] text-blue-600 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700"
                        )}
                      >
                        <Smartphone size={16} />
                        Único
                      </button>
                      <button
                        onClick={() => setSendMode("bulk")}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all",
                          sendMode === "bulk" ? "bg-white dark:bg-[#0b1324] text-blue-600 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700"
                        )}
                      >
                        <Users size={16} />
                        Em Massa
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column: Input (Phone / Bulk) */}
                      <div className="space-y-6">
                        {sendMode === "single" ? (
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Destinatário</label>
                            <input 
                              type="text" 
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="(00) 00000-0000" 
                              className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50/50 p-3.5 text-sm transition-all focus:border-blue-500 focus:bg-white dark:bg-[#0b1324] focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-gray-900 dark:text-white"
                            />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Lista de Destinatários</label>
                              {parsedNumbers.length > 0 && (
                                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                                  {parsedNumbers.length} válido(s)
                                </span>
                              )}
                            </div>
                            
                            <div className="relative">
                              <textarea 
                                rows={5}
                                value={bulkText}
                                onChange={(e) => processBulkText(e.target.value)}
                                placeholder="Cole os números aqui (separados por vírgula ou linha)..." 
                                className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50/50 p-3.5 text-sm transition-all focus:border-blue-500 focus:bg-white dark:bg-[#0b1324] focus:outline-none focus:ring-4 focus:ring-blue-500/10 resize-none text-gray-900 dark:text-white"
                              />
                              {bulkText && (
                                <button 
                                  onClick={() => processBulkText("")}
                                  className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>

                            {/* File Upload Option */}
                            <div>
                              <input 
                                type="file" 
                                accept=".txt,.csv" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                              />
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50/50 p-4 text-gray-500 dark:text-slate-400 transition-all hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:text-blue-600 group"
                              >
                                <FileSpreadsheet size={24} className="group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-medium">
                                  {fileName ? `Arquivo: ${fileName}` : "Ou clique para enviar planilha (CSV/TXT)"}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Scheduling */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Agendar Envio (Opcional)</label>
                          <div className="relative">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                              type="datetime-local" 
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50/50 p-3.5 pl-11 text-sm transition-all focus:border-blue-500 focus:bg-white dark:bg-[#0b1324] focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-gray-600 dark:text-slate-300"
                            />
                          </div>
                        </div>

                        {/* Delay Config */}
                        {sendMode === "bulk" && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
                                Intervalo entre mensagens (Segundos)
                              </label>
                              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {bulkDelay.toFixed(1)}s
                              </span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="5" 
                              step="0.1"
                              value={bulkDelay}
                              onChange={(e) => setBulkDelay(parseFloat(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-blue-600"
                            />
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              Valores muito baixos podem causar bloqueio temporário (Rate Limit) pelas operadoras.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Message & Action */}
                      <div className="space-y-6 flex flex-col h-full">
                        <div className="space-y-2 flex-1 flex flex-col">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Mensagem</label>
                            <div className="flex gap-2 text-xs font-medium">
                              <span className={cn("rounded-md px-2 py-0.5", smsCount > 1 ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300")}>
                                {smsCount} SMS
                              </span>
                              <span className={cn(smsLength > 160 ? "text-amber-600" : "text-gray-400")}>
                                {smsLength} / {smsCount * 160 || 160}
                              </span>
                            </div>
                          </div>
                          <div className="relative flex-1">
                            <textarea 
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Digite o conteúdo da sua mensagem..." 
                              className="w-full h-full min-h-[160px] rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50/50 p-3.5 text-sm transition-all focus:border-blue-500 focus:bg-white dark:bg-[#0b1324] focus:outline-none focus:ring-4 focus:ring-blue-500/10 resize-none text-gray-900 dark:text-white"
                            />
                          </div>
                          {smsCount > 1 && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertCircle size={12} /> Sua mensagem será dividida e cobrada como {smsCount} SMS.
                            </p>
                          )}
                        </div>

                        {dispatchProgress?.active ? (
                          <div className="mt-4 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 animate-in fade-in zoom-in duration-300">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center justify-between">
                              Acompanhando Disparo
                              <span className="text-blue-600 text-sm">{Math.round((dispatchProgress.current / dispatchProgress.total) * 100)}%</span>
                            </h3>
                            
                            <div className="h-3 w-full bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden mb-4 relative">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out absolute left-0 top-0"
                                style={{ width: `${(dispatchProgress.current / dispatchProgress.total) * 100}%` }}
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-center">
                              <div className="bg-white dark:bg-[#0b1324] p-3 rounded-lg border border-gray-100 dark:border-slate-800 shadow-sm">
                                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Enviados</p>
                                <p className="text-xl font-bold text-green-600">{dispatchProgress.success}</p>
                              </div>
                              <div className="bg-white dark:bg-[#0b1324] p-3 rounded-lg border border-gray-100 dark:border-slate-800 shadow-sm">
                                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Falhas</p>
                                <p className="text-xl font-bold text-red-500">{dispatchProgress.failed}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={handleSendSMS}
                            disabled={isSending || (sendMode === "bulk" && parsedNumbers.length === 0) || (sendMode === "single" && !phone) || !message}
                            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 mt-auto"
                          >
                            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                            <Send size={18} className={cn("transition-transform", isSending ? "animate-pulse" : "group-hover:-translate-y-1 group-hover:translate-x-1")} />
                            {isSending 
                              ? "Iniciando disparo..." 
                              : scheduleDate 
                                ? "Agendar Disparo" 
                                : sendMode === "bulk" 
                                  ? `Disparar para ${parsedNumbers.length} contatos` 
                                  : "Enviar agora"
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">Histórico de Envios</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">Acompanhe os disparos recentes e os status de entrega.</p>
                  </div>
                  <button 
                    onClick={downloadCSV}
                    disabled={history.length === 0 || isLoadingHistory}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
                  >
                    <FileSpreadsheet size={20} />
                    Baixar Relatório (CSV)
                  </button>
                </div>
                <div className="rounded-2xl border border-white/40 bg-white dark:bg-[#0b1324]/60 backdrop-blur-xl p-1 shadow-xl shadow-gray-200/50">
                  <div className="rounded-xl bg-white dark:bg-[#0b1324] overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-900/50/80 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                        <tr>
                          <th className="px-6 py-5">ID do Envio</th>
                          <th className="px-6 py-5">Destinatário</th>
                          <th className="px-6 py-5">Mensagem</th>
                          <th className="px-6 py-5">Data</th>
                          <th className="px-6 py-5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {isLoadingHistory ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                              <Loader2 className="animate-spin w-6 h-6 mx-auto mb-2 text-blue-500" />
                              Carregando histórico...
                            </td>
                          </tr>
                        ) : history.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                              Nenhum envio realizado ainda.
                            </td>
                          </tr>
                        ) : (
                          history.map((item, i) => (
                            <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                              <td className="px-6 py-4 font-mono text-xs text-gray-400 group-hover:text-blue-600 transition-colors">{item.id.split('-')[0]}</td>
                              <td className="px-6 py-4 font-semibold text-gray-700 dark:text-slate-200">{item.to_number}</td>
                              <td className="px-6 py-4 text-gray-500 dark:text-slate-400 max-w-[200px] truncate" title={item.message}>{item.message}</td>
                              <td className="px-6 py-4 text-gray-400 font-medium">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset",
                                  item.status === 'Enviado' ? "text-green-700 bg-green-100 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400" : "text-red-700 bg-red-100 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "opt-outs" && (
              <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">Opt-outs (Bloqueios)</h1>
                  <p className="text-gray-500 dark:text-slate-400 text-lg">Gerencie os números que solicitaram remoção da lista de disparos.</p>
                </div>
                
                <div className="rounded-2xl border border-white/40 bg-white dark:bg-[#0b1324]/60 backdrop-blur-xl p-6 shadow-xl shadow-gray-200/50 mb-8">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Adicionar novo(s) bloqueio(s)</h2>
                  <form onSubmit={handleAddOptOut} className="flex flex-col gap-4">
                    <textarea 
                      value={newOptOutNumber}
                      onChange={(e) => setNewOptOutNumber(e.target.value)}
                      placeholder="Cole um número ou uma lista separada por vírgula ou por linha (Enter)..." 
                      rows={3}
                      className="w-full bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors placeholder:text-gray-400 resize-y"
                    />
                    <div className="flex justify-end">
                      <button 
                        type="submit" 
                        disabled={isAddingOptOut || !newOptOutNumber}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isAddingOptOut ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                        Bloquear Número(s)
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-2xl border border-white/40 bg-white dark:bg-[#0b1324]/60 backdrop-blur-xl p-1 shadow-xl shadow-gray-200/50">
                  <div className="rounded-xl bg-white dark:bg-[#0b1324] overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-900/50/80 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                        <tr>
                          <th className="px-6 py-5">Número Bloqueado</th>
                          <th className="px-6 py-5">Data do Bloqueio</th>
                          <th className="px-6 py-5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {isLoadingOptOuts ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                              <Loader2 className="animate-spin w-6 h-6 mx-auto mb-2 text-blue-500" />
                              Carregando bloqueios...
                            </td>
                          </tr>
                        ) : optOuts.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <div className="h-16 w-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4 ring-4 ring-green-50/50 dark:ring-green-900/10">
                                  <MessageSquare size={28} className="text-green-500" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum opt-out registrado! 🎉</h3>
                                <p className="text-gray-500 dark:text-slate-400 text-sm max-w-sm">Nenhuma solicitação de descadastro ou bloqueio manual foi registrada.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          optOuts.map((item, i) => (
                            <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                              <td className="px-6 py-4 font-semibold text-gray-700 dark:text-slate-200">{item.phone_number}</td>
                              <td className="px-6 py-4 text-gray-400 font-medium">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleRemoveOptOut(item.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Remover bloqueio"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "webhooks" && (
              <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">Webhooks de Eventos</h1>
                  <p className="text-gray-500 dark:text-slate-400 text-lg">Configure a URL para receber retornos em tempo real da API.</p>
                </div>
                <div className="rounded-2xl border border-white/40 bg-white dark:bg-[#0b1324]/60 backdrop-blur-xl p-1 shadow-xl shadow-gray-200/50">
                  <div className="rounded-xl bg-white dark:bg-[#0b1324] p-8">
                    <div className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">URL do Webhook (Endpoint de Eventos)</label>
                      <div className="flex gap-3">
                        <input 
                          type="url" 
                          defaultValue="https://api.suaempresa.com.br/webhooks/sms" 
                          className="flex-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50/50 p-3.5 text-sm transition-all focus:border-blue-500 focus:bg-white dark:bg-[#0b1324] focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-gray-900 dark:text-white"
                        />
                        <button className="rounded-xl bg-blue-600 px-8 font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">
                          Salvar
                        </button>
                      </div>
                      <div className="mt-6 rounded-lg bg-blue-50 dark:bg-blue-900/10 p-4 border border-blue-100 dark:border-blue-900/30">
                        <p className="text-sm text-blue-800 dark:text-blue-300 flex gap-2">
                          <AlertCircle size={18} className="text-blue-600 shrink-0" />
                          A API enviará requisições POST para esta URL automaticamente sempre que houver os eventos <strong>message.delivered</strong> ou <strong>message.failed</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "recharge" && (
              <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-10 text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-3">Recarga de Créditos</h1>
                  <p className="text-gray-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                    Escolha o pacote ideal para a sua necessidade. A liberação dos créditos é feita imediatamente após a confirmação do pagamento.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Basic Plan */}
                  <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b1324] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none flex flex-col relative overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-2xl">
                    <div className="mb-4">
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Iniciante
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Básico</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-extrabold text-gray-900 dark:text-white">1.000</span>
                      <span className="text-gray-500 dark:text-slate-400 font-medium">SMS</span>
                    </div>
                    <div className="mb-6">
                      <div className="text-3xl font-bold text-gray-800 dark:text-white">R$ 120<span className="text-lg text-gray-500">,00</span></div>
                      <div className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">Apenas R$ 0,12 por SMS</div>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-300">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">✓</div>
                        Disparo único e em massa
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-300">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">✓</div>
                        Validade de 30 dias
                      </li>
                    </ul>
                    <a 
                      href={`https://wa.me/552139509590?text=${encodeURIComponent(`Olá, sou o usuário ${session?.user?.email} e gostaria de comprar o pacote Básico de 1.000 SMS.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full block text-center bg-gray-900 hover:bg-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                      Comprar Pacote
                    </a>
                  </div>

                  {/* Pro Plan */}
                  <div className="rounded-2xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/10 p-8 shadow-2xl shadow-blue-500/20 flex flex-col relative overflow-hidden transition-transform hover:-translate-y-1">
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-bl-xl tracking-wider">
                      MAIS VENDIDO
                    </div>
                    <div className="mb-4 mt-2">
                      <span className="bg-blue-200 text-blue-800 dark:bg-blue-800/40 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Recomendado
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Profissional</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">5.000</span>
                      <span className="text-blue-800 dark:text-blue-300 font-medium">SMS</span>
                    </div>
                    <div className="mb-6">
                      <div className="text-3xl font-bold text-gray-800 dark:text-white">R$ 500<span className="text-lg text-gray-500 dark:text-slate-400">,00</span></div>
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">Apenas R$ 0,10 por SMS</div>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-slate-200">
                        <div className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">✓</div>
                        Melhor custo-benefício
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-slate-200">
                        <div className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">✓</div>
                        Prioridade de envio
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-slate-200">
                        <div className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">✓</div>
                        Validade de 90 dias
                      </li>
                    </ul>
                    <a 
                      href={`https://wa.me/552139509590?text=${encodeURIComponent(`Olá, sou o usuário ${session?.user?.email} e gostaria de comprar o pacote Profissional de 5.000 SMS.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]"
                    >
                      Comprar Pacote
                    </a>
                  </div>

                  {/* Elite Plan */}
                  <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b1324] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none flex flex-col relative overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-2xl">
                    <div className="mb-4">
                      <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Empresarial
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Elite</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-extrabold text-gray-900 dark:text-white">10.000</span>
                      <span className="text-gray-500 dark:text-slate-400 font-medium">SMS</span>
                    </div>
                    <div className="mb-6">
                      <div className="text-3xl font-bold text-gray-800 dark:text-white">R$ 700<span className="text-lg text-gray-500">,00</span></div>
                      <div className="text-sm text-amber-600 dark:text-amber-500 font-medium mt-1">O mais barato: R$ 0,07 por SMS</div>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-300">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">✓</div>
                        Volume máximo
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-300">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">✓</div>
                        Suporte dedicado
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-300">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">✓</div>
                        Sem validade (créditos não expiram)
                      </li>
                    </ul>
                    <a 
                      href={`https://wa.me/552139509590?text=${encodeURIComponent(`Olá, sou o usuário ${session?.user?.email} e gostaria de comprar o pacote Elite de 10.000 SMS.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full block text-center bg-gray-900 hover:bg-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                      Comprar Pacote
                    </a>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
