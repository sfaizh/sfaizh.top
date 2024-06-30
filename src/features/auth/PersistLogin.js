import { Outlet, Link, useNavigate } from "react-router-dom"
import { useEffect, useRef, useState } from 'react'
import { useRefreshMutation } from "./authApiSlice"
import usePersist from "../../utils/hooks/usePersist"
import { useSelector } from 'react-redux'
import { selectCurrentToken } from "./authSlice"
import PulseLoader from 'react-spinners/PulseLoader'

const PersistLogin = () => {

    const [persist] = usePersist()
    const token = useSelector(selectCurrentToken)
    const effectRan = useRef(false)

    const [trueSuccess, setTrueSuccess] = useState(false)

    const [refresh, {
        isUninitialized,
        isLoading,
        isSuccess,
        isError,
        error
    }] = useRefreshMutation()

    const navigate = useNavigate()

    useEffect(() => {

        if (effectRan.current === true) {
            return;
        }
        effectRan.current = true
        const verifyRefreshToken = async () => {
            try {
                await refresh()
                setTrueSuccess(true)
            }
            catch (err) {
                console.error(err)
            }
        }
        if (!token && persist) verifyRefreshToken()
    }, [])


    let content
    if (!persist) { // persist: no
        content = <Outlet />
    } else if (persist && isLoading) { //persist: yes, token: no
        content = <PulseLoader color={"#FFF"} />
    } else if (persist && isError) { //persist: yes, token: no
        console.log('error')
        content = (
            <p className='errmsg'>
                {`${error?.data?.message} - `}
                <Link to="/login">Please login again</Link>.
            </p>
        )
    } else if (persist && isSuccess && trueSuccess) { //persist: yes, token: yes
        content = <Outlet />
    } else if (persist && token && isUninitialized) { //persist: yes, token: yes
        content = <Outlet />
    }

    return content
}
export default PersistLogin