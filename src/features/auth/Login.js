import React, { useRef, useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setCredentials } from './authSlice'
import { useLoginMutation } from './authApiSlice'
import usePersist from '../../utils/hooks/usePersist'
import useTitle from '../../utils/hooks/useTitle'
import PulseLoader from 'react-spinners/PulseLoader'
import "../../components/admin/admin.css";
import Header from "../../components/common/chakra_header.js";
import Footer from "../../components/common/footer.js";
import { VStack, HStack, Flex, Box, Heading, Spacer, Text, Center } from "@chakra-ui/layout";
import { Checkbox, CheckboxGroup, calc } from '@chakra-ui/react'
import {
    Image,
    Button,
    Input,
    InputGroup,
    InputRightElement,
    FormControl
} from '@chakra-ui/react'
import { useForm } from "react-hook-form";
import { UserAuth } from '../../context/AuthContext.js';

import {
    Container,
    Tag
} from "@chakra-ui/react";

const Login = () => {
    useTitle('Employee Login')

    const userRef = useRef()
    const errRef = useRef()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [errMsg, setErrMsg] = useState('')
    const [persist, setPersist] = usePersist()

    const navigate = useNavigate()
    const dispatch = useDispatch()

    const [login, { isLoading }] = useLoginMutation()

    useEffect(() => {
        // userRef.current.focus()
    }, [])

    useEffect(() => {
        setErrMsg('');
    }, [username, password])


    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            setPersist(prev => !prev)
            const { accessToken } = await login({ username, password }).unwrap()
            dispatch(setCredentials({ accessToken }))
            // localStorage.setItem("persist", true)
            setUsername('')
            setPassword('')
            navigate('/_cpanel')
        } catch (err) {
            if (!err.status) {
                setErrMsg('No Server Response');
            } else if (err.status === 400) {
                setErrMsg('Missing Username or Password');
            } else if (err.status === 401) {
                setErrMsg('Unauthorized');
            } else {
                setErrMsg(err.data?.message);
            }
            // errRef.current.focus();
        }
    }

    const handleUserInput = (e) => setUsername(e.target.value)
    const handlePwdInput = (e) => setPassword(e.target.value)
    const handleToggle = () => setPersist(prev => !prev)

    const [show, setShow] = React.useState(false)
    const handleClick = () => setShow(!show)
    // const useStyles = makeStyles({
    //     width: 'calc(100vh - 200px)'
    // });

    const errClass = errMsg ? "errmsg" : "offscreen"

    if (isLoading) return <PulseLoader color={"#FFF"} />

    const content = (
        <VStack p={5}>
            <Header />
                <Center h={"calc(100vh - 14rem)"}>
                    {/* <p ref={errRef} className={errClass} aria-live="assertive">{errMsg}</p> */}
                    <form className="form" onSubmit={handleSubmit}>
                        <VStack>
                            <Input
                                className="form__input"
                                required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
                                autoComplete="off"
                                ref={userRef}
                            />
                            <InputGroup size='md'>
                                <Input
                                    className="form__input"
                                    pr='4.5rem'
                                    type={show ? 'text' : 'password'}
                                    placeholder='Password'
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <InputRightElement width='4.5rem'>
                                    <Button h='1.75rem' size='sm' onClick={handleClick}>
                                        {show ? 'Hide' : 'Show'}
                                    </Button>
                                </InputRightElement>
                            </InputGroup>
                            {/* <label htmlFor="persist" className="form__persist">
                                <Checkbox className="form__checkbox" id="persist" onChange={handleToggle} checked={persist}>Trust This Device</Checkbox>
                            </label> */}
                            {/* <Form.Group>
                            <Form.Control type="username" required value={username} onChange={e => setusername(e.target.value)} placeholder="Enter Username"/>
                            <Form.Control type="password" required value={password} onChange={e => setpassword(e.target.value)} placeholder="Enter Current Password"/>
                        </Form.Group> */}
                            <br />
                            {/* <Button as={Link} to="/" variant="primary">Back</Button> */}
                            <Button
                                type="submit"
                                className="form__input-button"
                            >Login
                            </Button>
                        </VStack>
                    </form>
                </Center>
            <Footer />
        </VStack>
    )

    return content
}
export default Login