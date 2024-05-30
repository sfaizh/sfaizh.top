import { FaSun, FaMoon, FaInstagram, FaGithub, FaLinkedin } from "react-icons/fa";
import { Link } from '@chakra-ui/react'
import { IconButton } from "@chakra-ui/button";
import { Flex, StackDivider, Box, VStack, Heading, Spacer } from "@chakra-ui/layout";
import "../home/home.css";
import { all } from "axios";

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
                <Box pb={10} className="footer-wrapper">© 2024 <a style={{'all': 'unset'}} href='mailto:faizanh53@gmail.com'>Faizan H.</a></Box>
            </VStack>
        </Flex>
    );
}

export default Footer;