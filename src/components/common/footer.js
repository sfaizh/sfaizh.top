import { FaSun, FaMoon, FaInstagram, FaGithub, FaLinkedin } from "react-icons/fa";
import { Link } from '@chakra-ui/react'
import { IconButton } from "@chakra-ui/button";
import { Flex, StackDivider, Box, VStack, Heading, Spacer } from "@chakra-ui/layout";
import "../home/home.css";

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
                    <Link target="_blank" href="https://github.com/FaizanH">
                        <IconButton ml={5} icon={<FaGithub/>} isRound="true"></IconButton>
                    </Link>
                </Box>
                <Box className="footer-wrapper">Copyright © 2022 Faizan H.</Box>
            </VStack>
        </Flex>
    );
}

export default Footer;