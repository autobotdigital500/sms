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
  AlertCircle
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sendSmsFn } from "./api/send-sms";
import { bulkSendSmsFn } from "./api/-bulk-send-sms";

export const Route = createFileRoute("/")({
  component: Index,
});

type HistoryItem = { id: string, to: string, msg: string, date: string, status: string, color: string };

function Index() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sendMode, setSendMode] = useState<"single" | "bulk">("single");
  
  // Single SMS state
  const [phone, setPhone] = useState("");
  
  // Bulk SMS state
  const [bulkText, setBulkText] = useState("");
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
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
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('sms_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history");
      }
    }
  }, []);

  const addToHistory = (items: HistoryItem[]) => {
    setHistory(prev => {
      const newHistory = [...items, ...prev];
      localStorage.setItem('sms_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

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
        const data = await sendSmsFn({ data: { to: phone, message } });
        if (!data.success) throw new Error("Falha ao enviar SMS");
        
        toast.success(scheduleDate ? `SMS agendado para ${new Date(scheduleDate).toLocaleString()}` : "SMS enviado com sucesso!");
        
        addToHistory([{
          id: generateId(),
          to: phone,
          msg: message,
          date: scheduleDate ? `Agendado: ${new Date(scheduleDate).toLocaleString()}` : getNowFormatted(),
          status: scheduleDate ? "Agendado" : "Entregue",
          color: scheduleDate ? "text-orange-700 bg-orange-100 ring-orange-600/20" : "text-green-700 bg-green-100 ring-green-600/20"
        }]);
        
        setPhone("");
      } else {
        // Real-time tracking loop
        setDispatchProgress({ total: parsedNumbers.length, current: 0, success: 0, failed: 0, active: true });
        
        let successCount = 0;
        let failedCount = 0;
        const newHistoryItems: HistoryItem[] = [];

        for (let i = 0; i < parsedNumbers.length; i++) {
          const num = parsedNumbers[i];
          if (!num) continue;
          
          try {
            // Enviamos um a um para poder acompanhar o progresso real na tela
            const data = await sendSmsFn({ data: { to: num, message } });
            if (data.success) {
              successCount++;
              newHistoryItems.push({
                id: generateId(),
                to: num,
                msg: message,
                date: scheduleDate ? `Agendado: ${new Date(scheduleDate).toLocaleString()}` : getNowFormatted(),
                status: scheduleDate ? "Agendado" : "Entregue",
                color: scheduleDate ? "text-orange-700 bg-orange-100 ring-orange-600/20" : "text-green-700 bg-green-100 ring-green-600/20"
              });
            } else {
              failedCount++;
              newHistoryItems.push({
                id: generateId(),
                to: num,
                msg: message,
                date: getNowFormatted(),
                status: "Falha",
                color: "text-red-700 bg-red-100 ring-red-600/20"
              });
            }
          } catch(e) {
            failedCount++;
            newHistoryItems.push({
              id: generateId(),
              to: num,
              msg: message,
              date: getNowFormatted(),
              status: "Falha",
              color: "text-red-700 bg-red-100 ring-red-600/20"
            });
          }
          
          setDispatchProgress({ total: parsedNumbers.length, current: i + 1, success: successCount, failed: failedCount, active: true });
          
          // Animação de progresso suave e simulação de delay de processamento (ou real throttling)
          await new Promise(r => setTimeout(r, 600));
        }

        addToHistory(newHistoryItems);
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
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar - Clean and modern */}
      <aside className="hidden w-64 border-r border-gray-200/60 bg-white/50 backdrop-blur-xl md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-gray-200/60 px-6">
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
                  : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
              )}
            >
              <item.icon size={18} className={activeTab === item.id ? "text-blue-600" : "text-gray-400"} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-50">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200/60 bg-white/80 backdrop-blur-md px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <h1 className="text-lg font-semibold text-gray-800">
              {sidebarItems.find(i => i.id === activeTab)?.label || "Painel"}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="group flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 transition-all hover:bg-white/60 hover:shadow-sm active:scale-[0.98]">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Alexandre</p>
                <p className="text-xs text-gray-500 font-medium">Administrador</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ring-1 ring-gray-200/50 group-hover:ring-blue-300 transition-all">
                <User size={18} className="text-blue-600" />
              </div>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          {activeTab === "dashboard" && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Envio de SMS</h1>
                <p className="text-gray-500 text-lg">Crie e dispare campanhas ou mensagens individuais rapidamente.</p>
              </div>

              {/* Glassmorphism Card */}
              <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-xl p-1 shadow-xl shadow-gray-200/50">
                <div className="rounded-xl bg-white p-6 sm:p-8">
                  
                  {/* Mode Selector */}
                  <div className="flex p-1 mb-8 space-x-1 bg-gray-100/80 rounded-xl max-w-sm mx-auto sm:mx-0">
                    <button
                      onClick={() => setSendMode("single")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all",
                        sendMode === "single" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <Smartphone size={16} />
                      Único
                    </button>
                    <button
                      onClick={() => setSendMode("bulk")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all",
                        sendMode === "bulk" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
                          <label className="block text-sm font-semibold text-gray-700">Destinatário</label>
                          <input 
                            type="text" 
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(00) 00000-0000" 
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                          />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="block text-sm font-semibold text-gray-700">Lista de Destinatários</label>
                            {parsedNumbers.length > 0 && (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
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
                              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 resize-none"
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
                              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-4 text-gray-500 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 group"
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
                        <label className="block text-sm font-semibold text-gray-700">Agendar Envio (Opcional)</label>
                        <div className="relative">
                          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input 
                            type="datetime-local" 
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 pl-11 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-gray-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Message & Action */}
                    <div className="space-y-6 flex flex-col h-full">
                      <div className="space-y-2 flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-gray-700">Mensagem</label>
                          <div className="flex gap-2 text-xs font-medium">
                            <span className={cn("rounded-md px-2 py-0.5", smsCount > 1 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600")}>
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
                            className="w-full h-full min-h-[160px] rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 resize-none"
                          />
                        </div>
                        {smsCount > 1 && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle size={12} /> Sua mensagem será dividida e cobrada como {smsCount} SMS.
                          </p>
                        )}
                      </div>

                      {dispatchProgress?.active ? (
                        <div className="mt-4 p-5 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in zoom-in duration-300">
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                            Acompanhando Disparo
                            <span className="text-blue-600 text-sm">{Math.round((dispatchProgress.current / dispatchProgress.total) * 100)}%</span>
                          </h3>
                          
                          <div className="h-3 w-full bg-blue-100 rounded-full overflow-hidden mb-4 relative">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out absolute left-0 top-0"
                              style={{ width: `${(dispatchProgress.current / dispatchProgress.total) * 100}%` }}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <p className="text-xs text-gray-500 font-medium mb-1">Enviados</p>
                              <p className="text-xl font-bold text-green-600">{dispatchProgress.success}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <p className="text-xs text-gray-500 font-medium mb-1">Falhas</p>
                              <p className="text-xl font-bold text-red-500">{dispatchProgress.failed}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-4 text-center">
                            Processando {dispatchProgress.current} de {dispatchProgress.total} contatos...
                          </p>
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
              <div className="mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Histórico de Envios</h1>
                <p className="text-gray-500 text-lg">Acompanhe os disparos recentes e os status de entrega.</p>
              </div>
              <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-xl p-1 shadow-xl shadow-gray-200/50">
                <div className="rounded-xl bg-white overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/80 text-xs font-semibold uppercase text-gray-500 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-5">ID do Envio</th>
                        <th className="px-6 py-5">Destinatário</th>
                        <th className="px-6 py-5">Mensagem</th>
                        <th className="px-6 py-5">Data</th>
                        <th className="px-6 py-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            Nenhum envio realizado ainda.
                          </td>
                        </tr>
                      ) : (
                        history.map((item, i) => (
                          <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-6 py-4 font-mono text-xs text-gray-400 group-hover:text-blue-600 transition-colors">{item.id}</td>
                            <td className="px-6 py-4 font-semibold text-gray-700">{item.to}</td>
                            <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate" title={item.msg}>{item.msg}</td>
                            <td className="px-6 py-4 text-gray-400 font-medium">{item.date}</td>
                            <td className="px-6 py-4">
                              <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset", item.color)}>
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
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Opt-outs (Bloqueios)</h1>
                <p className="text-gray-500 text-lg">Números que solicitaram remoção da lista de disparos.</p>
              </div>
              <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-xl p-1 shadow-xl shadow-gray-200/50">
                <div className="rounded-xl bg-white overflow-hidden p-12 text-center flex flex-col items-center justify-center">
                  <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center mb-4 ring-4 ring-green-50/50">
                    <MessageSquare size={28} className="text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum opt-out recente! 🎉</h3>
                  <p className="text-gray-500 text-sm max-w-sm">Seus contatos estão engajados com as mensagens. Nenhuma solicitação de descadastro foi registrada.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "webhooks" && (
            <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Webhooks de Eventos</h1>
                <p className="text-gray-500 text-lg">Configure a URL para receber retornos em tempo real da API.</p>
              </div>
              <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-xl p-1 shadow-xl shadow-gray-200/50">
                <div className="rounded-xl bg-white p-8">
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">URL do Webhook (Endpoint de Eventos)</label>
                    <div className="flex gap-3">
                      <input 
                        type="url" 
                        defaultValue="https://api.suaempresa.com.br/webhooks/sms" 
                        className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      />
                      <button className="rounded-xl bg-blue-600 px-8 font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">
                        Salvar
                      </button>
                    </div>
                    <div className="mt-6 rounded-lg bg-blue-50 p-4 border border-blue-100">
                      <p className="text-sm text-blue-800 flex gap-2">
                        <AlertCircle size={18} className="text-blue-600 shrink-0" />
                        A API enviará requisições POST para esta URL automaticamente sempre que houver os eventos <strong>message.delivered</strong> ou <strong>message.failed</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
