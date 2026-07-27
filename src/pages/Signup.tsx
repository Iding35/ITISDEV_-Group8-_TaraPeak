import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const experienceLevels = [
  {
    id: 'beginner',
    title: 'Beginner',
    description: 'Casual walks & gentle slopes.',
    icon: 'hiking',
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    description: 'Moderate hikes & steady inclines.',
    icon: 'terrain',
  },
  {
    id: 'expert',
    title: 'Expert',
    description: 'Technical paths & steep climbs.',
    icon: 'landscape',
  },
];

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hikerExperience, setHikerExperience] = useState('beginner');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signup({ 
        first_name: firstName, 
        last_name: lastName, 
        email, 
        password,
        hiker_experience: hikerExperience 
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow text-base font-body-md';
  const labelClass = 'font-label-md text-sm text-on-surface-variant font-medium';

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 flex-1 flex flex-col justify-center">
        <div className="mb-6 text-center sm:text-left">
          <h1 className="font-headline-lg text-3xl font-bold text-primary mb-1">Create an account</h1>
          <p className="text-base text-on-surface-variant font-body-md">
            Join to save custom routes and receive recommendations tuned to your pace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container-low p-6 sm:p-8 rounded-2xl border border-outline-variant/60 shadow-xs flex flex-col gap-6">
          
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            {/* Left Column: Personal Information */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center mb-1">
                <span className={labelClass}>Personal information</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>First name</span>
                  <input
                    type="text"
                    required
                    placeholder="Alex"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Last name</span>
                  <input
                    type="text"
                    required
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Email address</span>
                <input
                  type="email"
                  required
                  placeholder="alex.smith@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            {/* Right Column: Hiker Experience Cards */}
            <div className="flex flex-col gap-2 h-full">
              <div className="flex justify-between items-center mb-1">
                <span className={labelClass}>Typical hiking style</span>
              </div>
              <p className="text-sm text-on-surface-variant mb-3">
                Tailors trail difficulty ratings and suggestions to your comfort level.
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {experienceLevels.map((level) => {
                  const isSelected = hikerExperience === level.id;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setHikerExperience(level.id)}
                      className={`flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all duration-150 ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs'
                          : 'border-outline-variant/80 bg-surface-container-lowest hover:border-gray-300'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-gray-400'}`}>
                        {level.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                          {level.title}
                        </div>
                        <div className="text-xs text-on-surface-variant truncate">
                          {level.description}
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {error && (
            <div className="p-3.5 bg-error/10 border border-error/20 rounded-xl text-sm text-error font-medium">
              {error}
            </div>
          )}

          {/* Action Footer with extra spacing */}
          <div className="pt-6 mt-2 border-t border-outline-variant/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-body-md text-on-surface-variant text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Log in
              </Link>
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto rounded-xl bg-primary px-8 py-3.5 font-label-md text-base text-on-primary font-semibold transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60 shadow-sm"
            >
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}