import { FaSun, FaMoon, FaInstagram, FaGithub, FaLinkedin } from "react-icons/fa";
import { Link } from '@chakra-ui/react'
import { IconButton } from "@chakra-ui/button";
import { Flex, StackDivider, Box, VStack, Heading, Spacer } from "@chakra-ui/layout";
import "../home/home.css";
import { all } from "axios";
import CookieConsent from "react-cookie-consent";

const Footer = () => {
    return (
        <Flex>
            <VStack divider={<StackDivider borderColor='gray.850' />}>
                <Box>
                    <Link target="_blank" href="https://www.linkedin.com/in/sfaizanh/">
                        <IconButton icon={<FaLinkedin/>} isRound="true"></IconButton>
                    </Link>
                    <Link target="_blank" href="https://www.instagram.com/sfaizh__/">
                        <IconButton ml={5} icon={<FaInstagram/>} isRound="true"></IconButton>
                    </Link>
                    <Link target="_blank" href="https://github.com/sfaizh">
                        <IconButton ml={5} icon={<FaGithub/>} isRound="true"></IconButton>
                    </Link>
                </Box>
                <CookieConsent style={{'opacity':0.8}}>This website uses cookies to enhance the user experience.</CookieConsent>
                <Box pb={5} className="footer-wrapper">© 2024 <Link style={{'all': 'unset'}} href='mailto:faizanh53@gmail.com'>sfaizh</Link>.</Box>
            </VStack>
        </Flex>
    );
}

export default Footer;