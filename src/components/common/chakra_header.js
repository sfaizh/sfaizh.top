import "../home/home.css";

import { IconButton } from "@chakra-ui/button";
import { useColorMode } from "@chakra-ui/color-mode";
import { Flex, Heading, Spacer, HStack, } from "@chakra-ui/layout";
import { FaSun, FaMoon, FaInstagram, FaGithub, FaLinkedin, FaHive, FaUserAstronaut, FaUser, FaArrowRight } from "react-icons/fa";
import { CgLogIn } from "react-icons/cg";
import { Link, Box, useColorModeValue, Text } from '@chakra-ui/react'
import { Image } from '@chakra-ui/react'
import { Avatar, AvatarBadge, AvatarGroup, Wrap, WrapItem } from '@chakra-ui/react'
import useAuth from '../../utils/hooks/useAuth'
import { useNavigate } from "react-router-dom";

const Header = (props) => {
    const { colorMode, toggleColorMode } = useColorMode();
    const isDark = colorMode === "dark";
    const logoMode = useColorModeValue("light", "dark");
    const { username, isAdmin } = useAuth();
    const navigate = useNavigate();

    return (
        <Flex w="100%">
            <Heading ml="8" size="md" fontWeight="semibold" color="cyan.400">
                <Link href="/">
                    { (logoMode == "dark") ? <Box className="header-logo"></Box> : <Box className="header-logo-dark"></Box>}
                </Link>
            </Heading>
            <Spacer></Spacer>
            <HStack spacing="10px">
                <Wrap mt={4}>
                    <Link pr={2} href='/projects'>
                        Projects
                    </Link>
                    <Link pr={2} href='/blog'>
                        Posts
                    </Link>
                    <Link pr={1} href='/about'>
                        About
                    </Link>
                </Wrap>
                <IconButton mr={1} icon={isDark ? <FaSun/> : <FaMoon/>} isRound="true" onClick={toggleColorMode}></IconButton>
                <Link href='/_cpanel'>
                    <IconButton bg='#b4a389' icon={<CgLogIn/>} isRound="true"></IconButton>
                </Link>
            </HStack>
        </Flex>
    )
}

export default Header;