import "../home/home.css";

import { IconButton } from "@chakra-ui/button";
import { useColorMode } from "@chakra-ui/color-mode";
import { Flex, Heading, Spacer, HStack } from "@chakra-ui/layout";
import { FaSun, FaMoon, FaInstagram, FaGithub, FaLinkedin, FaHive, FaUserAstronaut, FaUser, FaArrowRight } from "react-icons/fa";
import { Link, Box, useColorModeValue } from '@chakra-ui/react'
import { Image } from '@chakra-ui/react'
import { Avatar, AvatarBadge, AvatarGroup, Wrap, WrapItem } from '@chakra-ui/react'
import useAuth from '../../utils/hooks/useAuth'

const Header = (props) => {
    const { colorMode, toggleColorMode } = useColorMode();
    const isDark = colorMode === "dark";
    const logoMode = useColorModeValue("light", "dark");
    const { username, isAdmin } = useAuth();

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
                    <WrapItem>
                        <Link href='/_cpanel'>
                            <Avatar style={{'color':'white'}} size='sm' bg='#b4a389' name={username} icon={<FaHive/>} />
                        </Link>
                    </WrapItem>
                </Wrap>
                <IconButton ml={2} icon={isDark ? <FaSun/> : <FaMoon/>} isRound="true" onClick={toggleColorMode}></IconButton>
            </HStack>
        </Flex>
    )
}

export default Header;