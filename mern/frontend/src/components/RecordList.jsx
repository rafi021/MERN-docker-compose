import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const Record = (props) => (
  <tr className="border-b border-white/8 transition-colors hover:bg-white/5">
    <td className="p-4 align-middle text-slate-100 [&amp;:has([role=checkbox])]:pr-0">
      {props.record.name}
    </td>
    <td className="p-4 align-middle text-slate-300 [&amp;:has([role=checkbox])]:pr-0">
      {props.record.position}
    </td>
    <td className="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
      <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
        {props.record.level}
      </span>
    </td>
    <td className="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
      <div className="flex gap-2">
        <Link
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
          to={`/edit/${props.record._id}`}
        >
          Edit
        </Link>
        <button
          className="inline-flex items-center justify-center rounded-full border border-rose-400/20 bg-rose-400/10 px-3.5 py-2 text-sm font-medium text-rose-100 transition hover:border-rose-300/40 hover:bg-rose-400/20 hover:text-white"
          color="red"
          type="button"
          onClick={() => {
            props.deleteRecord(props.record._id);
          }}
        >
          Delete
        </button>
      </div>
    </td>
  </tr>
);

export default function RecordList() {
  const [records, setRecords] = useState([]);
  const totalRecords = records.length;
  const totalLevels = [...new Set(records.map((record) => record.level))].length;

  // This method fetches the records from the database.
  useEffect(() => {
    async function getRecords() {
      const response = await fetch(`/record/`);
      if (!response.ok) {
        const message = `An error occurred: ${response.statusText}`;
        console.error(message);
        return;
      }
      const records = await response.json();
      setRecords(records);
    }
    getRecords();
    return;
  }, [records.length]);

  // This method will delete a record
  async function deleteRecord(id) {
    await fetch(`/record/${id}`, {
      method: "DELETE",
    });
    const newRecords = records.filter((el) => el._id !== id);
    setRecords(newRecords);
  }

  // This method will map out the records on the table
  function recordList() {
    return records.map((record) => {
      return (
        <Record
          record={record}
          deleteRecord={() => deleteRecord(record._id)}
          key={record._id}
        />
      );
    });
  }

  // This following section will display the table with the records of individuals.
  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-xl shadow-slate-950/20 backdrop-blur">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-200/70">
            Team overview
          </p>
          <h3 className="mt-3 text-3xl font-semibold text-slate-50">
            Manage records with a cleaner, more polished workflow.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Browse, edit, and remove records from a dashboard-style interface
            designed for clarity and quick actions.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-sm text-slate-400">Total records</p>
          <p className="mt-3 text-4xl font-semibold text-slate-50">{totalRecords}</p>
          <p className="mt-2 text-sm text-slate-400">Active user entries</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-sm text-slate-400">Levels represented</p>
          <p className="mt-3 text-4xl font-semibold text-slate-50">{totalLevels}</p>
          <p className="mt-2 text-sm text-slate-400">Intern, Junior, Senior</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h4 className="text-lg font-semibold text-slate-50">User List</h4>
            <p className="text-sm text-slate-400">
              All records currently stored in the system.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-300">
            Live data
          </div>
        </div>

        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="bg-white/5 text-slate-300 [&amp;_tr]:border-b [&amp;_tr]:border-white/10">
              <tr>
                <th className="h-12 px-6 text-left align-middle font-medium uppercase tracking-[0.18em] [&amp;:has([role=checkbox])]:pr-0">
                  Name
                </th>
                <th className="h-12 px-6 text-left align-middle font-medium uppercase tracking-[0.18em] [&amp;:has([role=checkbox])]:pr-0">
                  Position
                </th>
                <th className="h-12 px-6 text-left align-middle font-medium uppercase tracking-[0.18em] [&amp;:has([role=checkbox])]:pr-0">
                  Level
                </th>
                <th className="h-12 px-6 text-left align-middle font-medium uppercase tracking-[0.18em] [&amp;:has([role=checkbox])]:pr-0">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="[&amp;_tr:last-child]:border-0">
              {records.length ? (
                recordList()
              ) : (
                <tr>
                  <td className="px-6 py-16 text-center text-slate-400" colSpan="4">
                    No records yet. Create the first user to populate the table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
