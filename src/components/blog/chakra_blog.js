import "../industry-experience/industry.css";
import Footer from "../common/footer.js";
import Header from "../common/chakra_header.js";
import Blog_panel from "./blog_panel.js";
import Blog_panel_single_view from "./blog_panel_single_view.js";
import "./blog.css"

import { IconButton } from "@chakra-ui/button";
import { useColorMode } from "@chakra-ui/color-mode";
import { VStack, Flex, Heading, Spacer, Box, Divider, Container, Text } from "@chakra-ui/layout";
import { FaSun, FaMoon, FaInstagram, FaGithub, FaLinkedin } from "react-icons/fa";
import { Link, useColorModeValue, Image, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom';


const Blog = props => {
    const logoMode = useColorModeValue("light", "dark");
    const nav = useNavigate();

    const goToBlog = e => {
        e.preventDefault();
        nav("/blog");
    }

    return (
        <VStack p={5}>
            <Header />
            <Container
                maxW={{
                    base: "100%",
                    sm: "35rem",
                    md: "43.75rem",
                    lg: "57.5rem",
                    xl: "75rem",
                    xxl: "77.5rem"
                }}
            >
                <Link href="/portfolio/blog"><Heading pb={5} align="center" as="h1" size="4xl">Blog</Heading></Link>
                {/* { (logoMode == "dark") ? <Box className="blog-banner" pb="0px" align="center"></Box> : <Box className="blog-banner-dark" pb="0px" align="center"></Box>} */}
                {/* <Box className="blog-banner" pb="0px" align="center"></Box> */}
                <Text pb={5} align="center" fontSize="sm">Random snippets of stuff I do</Text>
                <Divider />
                {/* Check if single view or show all */}
                {(props.mode == "all") ? <Blog_panel /> : <Blog_panel_single_view />}
            </Container>
            <Footer />
        </VStack>
    )
}

export default Blog;