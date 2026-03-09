import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

export default function Login(){

const navigate = useNavigate()

const [email,setEmail] = useState("")
const [password,setPassword] = useState("")

const login = async () => {

try{

const res = await axios.post(
"http://localhost:8000/auth/login",
{ email,password }
)

localStorage.setItem("token",res.data.token)

navigate("/dashboard")

}catch(err){

alert("Invalid credentials")

}

}

return(

<div className="flex items-center justify-center h-screen">

<div className="bg-white p-8 rounded-xl shadow-md w-80">

<h2 className="text-xl font-bold mb-4">Login</h2>

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
onClick={login}
className="bg-blue-600 text-white w-full p-2 rounded"
>
Login
</button>

<p className="mt-3 text-sm">

New user? <a href="/signup" className="text-blue-600">Signup</a>

</p>

</div>

</div>

)

}