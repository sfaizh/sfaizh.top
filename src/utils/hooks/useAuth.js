import { useSelector } from 'react-redux'
import { selectCurrentToken } from "../../features/auth/authSlice"
import { jwtDecode } from 'jwt-decode'

const useAuth = () => {
    // Use http-only cookies for this instead of redux
    const token = useSelector(selectCurrentToken)
    let isManager = false
    let isAdmin = false
    let status = "Employee"

    // login problem is here - failing
    if (token) {
        const decoded = jwtDecode(token)
        const { username, roles } = decoded.UserInfo

        isManager = roles.includes('Manager')
        isAdmin = roles.includes('Admin')

        if (isManager) status = "Manager"
        if (isAdmin) status = "Admin"

        return { username, roles, status, isManager, isAdmin }
    }

    return { username: '', roles: [], isManager, isAdmin, status }
}
export default useAuth