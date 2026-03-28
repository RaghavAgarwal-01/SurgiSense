import { useState } from "react"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"

export default function Login() {
	const navigate = useNavigate()

	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")

	const login = async () => {
		try {
			const res = await axios.post("http://localhost:8000/auth/login", {
				email,
				password,
			})
			localStorage.clear()
			localStorage.setItem("token", res.data.token)
			navigate("/intake")
		} catch (err) {
			alert("Invalid credentials")
		}
	}

	return (
		<div className="min-h-screen bg-linear-to-br from-[#D3D0BC] via-[#D3D0BC] to-[#CBC3A5] flex items-center justify-center px-4 py-8">
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute top-16 left-8 h-40 w-40 rounded-full bg-[#9AA7B1]/20 blur-3xl" />
				<div className="absolute bottom-16 right-8 h-52 w-52 rounded-full bg-[#3E435D]/10 blur-3xl" />
			</div>

			<div className="relative w-full max-w-md rounded-2xl border border-[#3E435D]/15 bg-white/90 p-8 shadow-xl backdrop-blur-sm">
				<p className="text-sm font-medium tracking-wide text-[#9AA7B1]">Welcome back</p>
				<h2 className="mt-1 text-3xl font-bold text-[#3E435D]">Sign in to SurgiSense</h2>
				<p className="mt-2 text-sm text-[#3E435D]/70">Continue your post-surgery care journey.</p>

				<div className="mt-6 space-y-3">
					<input
						className="w-full rounded-xl border border-[#3E435D]/20 bg-white px-4 py-3 text-[#3E435D] placeholder:text-[#9AA7B1] outline-none transition focus:border-[#3E435D] focus:ring-2 focus:ring-[#9AA7B1]/40"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>

					<input
						className="w-full rounded-xl border border-[#3E435D]/20 bg-white px-4 py-3 text-[#3E435D] placeholder:text-[#9AA7B1] outline-none transition focus:border-[#3E435D] focus:ring-2 focus:ring-[#9AA7B1]/40"
						type="password"
						placeholder="Password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</div>

				<button
					onClick={login}
					className="mt-5 w-full rounded-xl bg-[#3E435D] px-4 py-3 font-semibold text-[#D3D0BC] transition hover:bg-[#34394F]"
				>
					Login
				</button>

				<a
					href="http://localhost:8000/auth/google"
					className="mt-3 block w-full rounded-xl border border-[#3E435D]/20 bg-[#CBC3A5] px-4 py-3 text-center font-semibold text-[#3E435D] transition hover:bg-[#c2b998]"
				>
					Continue with Google
				</a>

				<p className="mt-5 text-sm text-[#3E435D]/70">
					New user?{" "}
					<Link to="/signup" className="font-semibold text-[#3E435D] hover:text-[#9AA7B1]">
						Signup
					</Link>
				</p>
			</div>
		</div>
	)
}
