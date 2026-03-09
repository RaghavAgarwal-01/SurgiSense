import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ProfileSetup(){

const navigate = useNavigate()

const [patientName,setPatientName] = useState("")
const [surgeryType,setSurgeryType] = useState("")
const [surgeryDate,setSurgeryDate] = useState("")

const submitProfile = async () => {

const token = localStorage.getItem("token")

await axios.post(
"http://localhost:8000/api/create-profile",
{
patient_name:patientName,
surgery_type:surgeryType,
surgery_date:surgeryDate
},
{
headers:{
Authorization:`Bearer ${token}`
}
}
)

navigate("/dashboard")

}

return(

<div className="flex items-center justify-center min-h-screen">

<div className="bg-white p-8 rounded-xl shadow w-96">

<h2 className="text-xl font-bold mb-4">
Create Patient Profile
</h2>

<input
placeholder="Patient Name"
className="border w-full p-2 mb-3"
onChange={(e)=>setPatientName(e.target.value)}
/>

<input
placeholder="Surgery Type"
className="border w-full p-2 mb-3"
onChange={(e)=>setSurgeryType(e.target.value)}
/>

<input
type="date"
className="border w-full p-2 mb-3"
onChange={(e)=>setSurgeryDate(e.target.value)}
/>

<button
onClick={submitProfile}
className="bg-green-600 text-white w-full p-2 rounded"
>
Save Profile
</button>

</div>

</div>

)

}