import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

export default function OAuthSuccess(){

const navigate = useNavigate()

useEffect(()=>{

const params = new URLSearchParams(window.location.search)

const token = params.get("token")

if(token){

// Clear ALL previous user data before storing the new OAuth token.
localStorage.clear()
localStorage.setItem("token",token)
navigate("/intake")

}

},[])

return <div>Logging in...</div>

}