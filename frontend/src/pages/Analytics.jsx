import { useParams, useNavigate } from "react-router-dom";
import ClusteringTab from "../components/ClusteringTab";
import EscalationsTab from "../components/EscalationsTab";
import MovementsTab from "../components/MovementsTab";

const TABS = [
  { key: "clustering", label: "Clustering", icon: "◈" },
  { key: "escalations", label: "Escalations", icon: "↑" },
  { key: "movements", label: "Group Movements", icon: "⇄" },
];

export default function Analytics() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab && TABS.find((t) => t.key === tab) ? tab : "clustering";

  return (
    <div className="space-y-6">
      {/* Modern Tab Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 btn-press ${
              activeTab === t.key
                ? "bg-navy text-white shadow-sm"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => navigate(`/analytics/${t.key}`)}
          >
            <span className="text-xs opacity-70">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div key={activeTab} className="animate-fadeIn">
        {activeTab === "clustering" && <ClusteringTab />}
        {activeTab === "escalations" && <EscalationsTab />}
        {activeTab === "movements" && <MovementsTab />}
      </div>
    </div>
  );
}
