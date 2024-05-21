import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Divider } from "@chakra-ui/layout";
import { useMediaQuery, Button, Image, Show, Input, Link } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import posts from "../../assets/data/blogs.json";
import "../home/home.css";

import {
    Container,
    Tag
} from "@chakra-ui/react";

const Blog_sidebar = props => {
    const [isLargerScreen] = useMediaQuery("(min-width: 600px");

    const [data, setData] = useState([]);

    useEffect(() => {
        setData(posts.posts);
    }, []);


    return (
        <VStack p={3}>
            <Box>
                <Input width="auto" placeholder='Search' />
            </Box>
            <Spacer />
            {/* <Box>
                <Text fontSize="sm">FOLLOW</Text>
            </Box> */}
            <Spacer />
            <Box>
                <Text fontSize="sm"><strong>LINKS</strong></Text>
            </Box>
            <Box align="center">
                <Link href="https://www.linkedin.com/in/sfaizanh/" isExternal><Text>LinkedIn</Text></Link>
                <Link href="https://www.instagram.com/sfaizh__/" isExternal><Text>Instagram</Text></Link>
                <Link href="https://github.com/FaizanH" isExternal><Text>Github</Text></Link>
            </Box>
                {/* Links */}
                {/* Email */}
        </VStack>
    );
}

export default Blog_sidebar;