import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

export default function Signup(){

const navigate = useNavigate()

const [email,setEmail] = useState("")
const [password,setPassword] = useState("")

const signup = async () => {

await axios.post(
"http://localhost:8000/auth/signup",
{ email,password }
)

alert("Account created!")

navigate("/login")

}

return(

<div className="flex items-center justify-center h-screen">

<div className="bg-white p-8 rounded-xl shadow-md w-80">

<h2 className="text-xl font-bold mb-4">Create Account</h2>

<input
className="border w-full p-2 mb-3"
placeholder="Email"
onChange={(e)=>setEmail(e.target.value)}
/>

<input
className="border w-full p-2 mb-3"
type="password"
placeholder="Password"
onChange={(e)=>setPassword(e.target.value)}
/>

<button
onClick={signup}
className="bg-green-600 text-white w-full p-2 rounded"
>
Signup
</button>

</div>

</div>

)

}