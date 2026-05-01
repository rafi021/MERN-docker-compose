import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function Record() {
  const [form, setForm] = useState({
    name: "",
    position: "",
    level: "",
  });
  const [isNew, setIsNew] = useState(true);
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      const id = params.id?.toString() || undefined;
      if (!id) return;
      setIsNew(false);
      const response = await fetch(`/record/${params.id.toString()}`);
      if (!response.ok) {
        const message = `An error has occurred: ${response.statusText}`;
        console.error(message);
        return;
      }
      const record = await response.json();
      if (!record) {
        console.warn(`Record with id ${id} not found`);
        navigate("/");
        return;
      }
      setForm(record);
    }
    fetchData();
    return;
  }, [params.id, navigate]);

  // These methods will update the state properties.
  function updateForm(value) {
    return setForm((prev) => {
      return { ...prev, ...value };
    });
  }

  // This function will handle the submission.
  async function onSubmit(e) {
    e.preventDefault();
    const person = { ...form };
    try {
      let response;
      if (isNew) {
        response = await fetch(`/record`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(person),
        });
      } else {
        response = await fetch(`/record/${params.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(person),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      navigate("/");
    } catch (error) {
      console.error("A problem occurred adding or updating a record: ", error);
    }
  }

  // This following section will display the form that takes the input from the user.
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-6">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-200/70">
            User editor
          </p>
          <h3 className="text-3xl font-semibold text-slate-50">
            {isNew ? "Create a new user" : "Update an existing user"}
          </h3>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">
            Keep the fields concise and the experience focused. The interface is
            optimized for quick data entry and editing.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-slate-50">User Info</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Name, role, and level are used to present each record in the team
              table.
            </p>
          </div>

          <div className="grid gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-200">
                Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                className="mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-50 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
                placeholder="First Last"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
              />
            </div>

            <div>
              <label
                htmlFor="position"
                className="block text-sm font-medium text-slate-200"
              >
                Role
              </label>
              <input
                type="text"
                name="position"
                id="position"
                className="mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-50 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
                placeholder="Developer Advocate"
                value={form.position}
                onChange={(e) => updateForm({ position: e.target.value })}
              />
            </div>

            <fieldset className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <legend className="px-2 text-sm font-medium text-slate-200">
                Level
              </legend>
              <div className="mt-4 flex flex-wrap gap-3">
                {["Intern", "Junior", "Senior"].map((level) => (
                  <label
                    key={level}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${form.level === level
                      ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                      : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20 hover:bg-white/5"
                      }`}
                  >
                    <input
                      name="positionOptions"
                      type="radio"
                      value={level}
                      className="h-4 w-4 border-slate-300 text-cyan-500 focus:ring-cyan-500"
                      checked={form.level === level}
                      onChange={(e) => updateForm({ level: e.target.value })}
                    />
                    {level}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                Changes are saved immediately after submission.
              </p>
              <input
                type="submit"
                value={isNew ? "Save User Record" : "Update User Record"}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              />
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
