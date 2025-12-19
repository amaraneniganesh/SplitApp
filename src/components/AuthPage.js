import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { 
  ArrowRightIcon, 
  EnvelopeIcon, 
  LockClosedIcon, 
  UserIcon, 
  PhoneIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';

const AuthPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('LOGIN'); 
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    otp: ''
  });

  const API = axios.create({ baseURL: 'http://localhost:5000/api/auth' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- STRICT VALIDATION LOGIC ---
  const validateInputs = () => {
    // 1. Mobile Number (10 digits, starts with 6-9)
    if (view === 'REGISTER') {
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(formData.phone)) {
            toast.error("Invalid Mobile! Must be 10 digits & start with 6-9.");
            return false;
        }
    }

    // 2. Strong Password Validation
    // >6 chars, 1 Uppercase, 1 Lowercase, 1 Digit, 1 Special Char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{7,}$/;
    
    if (!passwordRegex.test(formData.password)) {
        toast.error("Weak Password! Use >6 chars, with Upper, Lower, Digit & Special char.");
        return false;
    }

    return true;
  };

  // --- ACTIONS ---
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateInputs()) return; // Stop if validation fails

    setIsLoading(true);
    try {
      await API.post('/register', formData);
      toast.success(`OTP Sent to ${formData.email}`);
      setView('OTP');
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await API.post('/verify-otp', { email: formData.email, otp: formData.otp });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success("Verified! Logging you in...");
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid Code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await API.post('/login', { email: formData.email, password: formData.password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success("Welcome back!");
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white font-sans selection:bg-black selection:text-white overflow-hidden">
      <Toaster position="top-center" richColors theme="light" />

      {/* --- LEFT SIDE: FORM --- */}
      <div className="w-full lg:w-1/2 h-full flex flex-col justify-center items-center p-8 lg:p-24 relative z-10">
        <div className="absolute top-10 left-10 lg:left-20 flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-black text-lg">S</div>
          <span className="font-bold text-xl tracking-tight">SplitApp</span>
        </div>

        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter text-gray-900">
              {view === 'LOGIN' && 'Welcome back'}
              {view === 'REGISTER' && 'Create an account'}
              {view === 'OTP' && 'Verify Email'}
            </h1>
            <p className="text-gray-500 font-medium">
              {view === 'LOGIN' && 'Enter your details to access your account.'}
              {view === 'REGISTER' && 'Join us to track expenses effortlessly.'}
              {view === 'OTP' && `Enter the code sent to ${formData.email}`}
            </p>
          </div>

          <div className="space-y-6">
            
            {/* 1. LOGIN FORM */}
            {view === 'LOGIN' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <InputGroup icon={<EnvelopeIcon className="w-5 h-5"/>} type="email" name="email" placeholder="name@example.com" onChange={handleChange} />
                <InputGroup icon={<LockClosedIcon className="w-5 h-5"/>} type="password" name="password" placeholder="Password" onChange={handleChange} />
                <Button loading={isLoading} text="Sign In" />
                <div className="pt-4 text-center">
                  <span className="text-sm text-gray-500">New here? </span>
                  <button type="button" onClick={() => setView('REGISTER')} className="text-sm font-bold text-black hover:underline">Create an account</button>
                </div>
              </form>
            )}

            {/* 2. REGISTER FORM */}
            {view === 'REGISTER' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <InputGroup icon={<UserIcon className="w-5 h-5"/>} type="text" name="username" placeholder="Full Name" onChange={handleChange} />
                
                {/* Mobile */}
                <InputGroup icon={<PhoneIcon className="w-5 h-5"/>} type="tel" name="phone" placeholder="Mobile (10 Digits)" maxLength="10" onChange={handleChange} />
                
                <InputGroup icon={<EnvelopeIcon className="w-5 h-5"/>} type="email" name="email" placeholder="Email Address" onChange={handleChange} />
                
                {/* Password (With Validation Prompt) */}
                <InputGroup icon={<LockClosedIcon className="w-5 h-5"/>} type="password" name="password" placeholder="Password (Strong)" onChange={handleChange} />
                
                <Button loading={isLoading} text="Continue" />
                <div className="pt-4 text-center">
                  <span className="text-sm text-gray-500">Already a member? </span>
                  <button type="button" onClick={() => setView('LOGIN')} className="text-sm font-bold text-black hover:underline">Sign in</button>
                </div>
              </form>
            )}

            {/* 3. OTP FORM */}
            {view === 'OTP' && (
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="flex justify-center">
                  <input name="otp" type="text" maxLength="6" placeholder="000000" autoFocus className="w-full text-center text-4xl font-black tracking-[0.5em] py-6 border-b-2 border-gray-200 focus:border-black focus:outline-none transition-colors bg-transparent placeholder:text-gray-200" onChange={handleChange} />
                </div>
                <Button loading={isLoading} text="Verify & Login" />
                <div className="pt-4 text-center">
                  <button type="button" onClick={() => setView('REGISTER')} className="text-xs font-bold text-gray-400 hover:text-black">Wrong email? Go back</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* --- RIGHT SIDE --- */}
      <div className="hidden lg:flex w-1/2 bg-black relative overflow-hidden items-center justify-center p-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-gray-800 via-black to-black opacity-80"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="relative z-10 text-white space-y-6 max-w-lg">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/10"><CheckBadgeIcon className="w-8 h-8 text-white"/></div>
          <h2 className="text-5xl font-bold tracking-tight leading-tight">Secure, Simple, Smart.</h2>
          <p className="text-lg text-gray-400 leading-relaxed">Split bills with friends and family instantly. Verified via secure Email OTP.</p>
        </div>
      </div>
    </div>
  );
};

const InputGroup = ({ icon, ...props }) => (<div className="relative group"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-black transition-colors">{icon}</div><input className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 focus:border-gray-200 transition-all" {...props} required /></div>);
const Button = ({ loading, text }) => (<button type="submit" disabled={loading} className="w-full bg-black text-white h-14 rounded-xl font-bold text-sm hover:bg-gray-900 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-gray-200 disabled:opacity-70 disabled:cursor-not-allowed">{loading ? (<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>) : (<>{text} <ArrowRightIcon className="w-4 h-4 stroke-[3]"/></>)}</button>);

export default AuthPage;