import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const mockInterviews = [
    { id: 1, role: 'Frontend Engineer', date: '2026-08-05', status: 'Completed', score: '82%' },
    { id: 2, role: 'Backend Developer', date: '2026-08-07', status: 'In Progress', score: '--' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Manage and practice your mock interview simulations.</p>
        </div>
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="self-start px-4 py-2 text-sm font-medium text-slate-350 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-850 p-6 rounded-xl">
          <h3 className="text-sm font-medium text-slate-400">Total Interviews</h3>
          <p className="text-3xl font-bold text-emerald-500 mt-2">2</p>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-6 rounded-xl">
          <h3 className="text-sm font-medium text-slate-400">Average Score</h3>
          <p className="text-3xl font-bold text-emerald-500 mt-2">82%</p>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-6 rounded-xl">
          <h3 className="text-sm font-medium text-slate-400">Next Scheduled</h3>
          <p className="text-sm font-medium text-slate-300 mt-4">None scheduled</p>
        </div>
      </div>

      <div className="mt-8 bg-slate-900 border border-slate-850 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent Mock Sessions</h2>
          <button
            id="btn-new-interview"
            onClick={() => alert('AI Interview simulation is not implemented in this MVP foundation.')}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Start New Mock
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300 text-sm">
              {mockInterviews.map((session) => (
                <tr key={session.id} className="hover:bg-slate-850/20">
                  <td className="px-6 py-4 font-medium text-white">{session.role}</td>
                  <td className="px-6 py-4">{session.date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      session.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{session.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
