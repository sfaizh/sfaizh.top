import "../home/home.css";

import { IconButton } from "@chakra-ui/button";
import { useColorMode } from "@chakra-ui/color-mode";
import { Flex, Heading, Spacer, HStack } from "@chakra-ui/layout";
import { FaSun, FaMoon, FaInstagram, FaGithub, FaLinkedin, FaHive } from "react-icons/fa";
import { Link, Box, useColorModeValue } from '@chakra-ui/react'
import { Image } from '@chakra-ui/react'


const Header = () => {
    const { colorMode, toggleColorMode } = useColorMode();
    const isDark = colorMode === "dark";
    const logoMode = useColorModeValue("light", "dark");
    return (
        <Flex w="100%">
            <Heading ml="8" size="md" fontWeight="semibold" color="cyan.400">
                <Link href="/">
                    { (logoMode == "dark") ? <Box className="header-logo"></Box> : <Box className="header-logo-dark"></Box>}
                </Link>
            </Heading>
            <Spacer></Spacer>
            <HStack spacing="20px">
                {/* <Link href="/_cpanel">
                    <IconButton ml={5} icon={<FaHive/>} isRound="true"></IconButton>
                </Link> */}
                <IconButton ml={8} icon={isDark ? <FaSun/> : <FaMoon/>} isRound="true" onClick={toggleColorMode}></IconButton>
            </HStack>

        </Flex>
    )
}

export default Header;