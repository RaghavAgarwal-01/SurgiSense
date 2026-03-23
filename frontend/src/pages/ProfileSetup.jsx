import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

export default function ProfileSetup() {
	const navigate = useNavigate()

	const [patientName, setPatientName] = useState("")
	const [surgeryType, setSurgeryType] = useState("")
	const [surgeryDate, setSurgeryDate] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const submitProfile = async () => {
		if (!patientName.trim() || !surgeryType.trim() || !surgeryDate) {
			alert("Please complete all fields before continuing.")
			return
		}

		const token = localStorage.getItem("token")

		if (!token) {
			alert("Please log in first.")
			navigate("/login")
			return
		}

		try {
			setIsSubmitting(true)

			await axios.post(
				"http://localhost:8000/api/create-profile",
				{
					patient_name: patientName.trim(),
					surgery_type: surgeryType.trim(),
					surgery_date: surgeryDate,
				},
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			)

			navigate("/dashboard")
		} catch (error) {
			if (error.response?.data?.detail) {
				alert(error.response.data.detail)
			} else {
				alert("Could not save profile. Please try again.")
			}
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div className="min-h-screen bg-linear-to-br from-[#D3D0BC] via-[#D3D0BC] to-[#CBC3A5] flex items-center justify-center px-4 py-8">
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute top-16 left-10 h-44 w-44 rounded-full bg-[#9AA7B1]/25 blur-3xl" />
				<div className="absolute bottom-12 right-10 h-56 w-56 rounded-full bg-[#3E435D]/10 blur-3xl" />
			</div>

			<div className="relative w-full max-w-md rounded-2xl border border-[#3E435D]/15 bg-white/90 p-8 shadow-xl backdrop-blur-sm">
				<p className="text-sm font-medium tracking-wide text-[#9AA7B1]">Set up your recovery profile</p>
				<h2 className="mt-1 text-3xl font-bold text-[#3E435D]">Create patient profile</h2>
				<p className="mt-2 text-sm text-[#3E435D]/70">Tell us a few details so SurgiSense can personalize your dashboard.</p>

				<div className="mt-6 space-y-3">
					<input
						placeholder="Patient Name"
						value={patientName}
						onChange={(e) => setPatientName(e.target.value)}
						className="w-full rounded-xl border border-[#3E435D]/20 bg-white px-4 py-3 text-[#3E435D] placeholder:text-[#9AA7B1] outline-none transition focus:border-[#3E435D] focus:ring-2 focus:ring-[#9AA7B1]/40"
					/>

					<input
						placeholder="Surgery Type"
						value={surgeryType}
						onChange={(e) => setSurgeryType(e.target.value)}
						className="w-full rounded-xl border border-[#3E435D]/20 bg-white px-4 py-3 text-[#3E435D] placeholder:text-[#9AA7B1] outline-none transition focus:border-[#3E435D] focus:ring-2 focus:ring-[#9AA7B1]/40"
					/>

					<div>
						<label className="mb-1 block text-sm text-[#3E435D]/70">Surgery Date</label>
						<input
							type="date"
							value={surgeryDate}
							onChange={(e) => setSurgeryDate(e.target.value)}
							className="w-full rounded-xl border border-[#3E435D]/20 bg-white px-4 py-3 text-[#3E435D] outline-none transition focus:border-[#3E435D] focus:ring-2 focus:ring-[#9AA7B1]/40"
						/>
					</div>
				</div>

				<button
					onClick={submitProfile}
					disabled={isSubmitting}
					className="mt-5 w-full rounded-xl bg-[#3E435D] px-4 py-3 font-semibold text-[#D3D0BC] transition hover:bg-[#34394F] disabled:cursor-not-allowed disabled:opacity-70"
				>
					{isSubmitting ? "Saving Profile..." : "Save Profile"}
				</button>
			</div>
		</div>
	)
}