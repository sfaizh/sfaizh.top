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
        <VStack alignItems='left' p={3}>
            <Box boxSize='xxs'>
                <Image width='200px' src="https://avatars.githubusercontent.com/u/18716739?v=4"/>
            </Box>
            <Box alignItems='left'>
                <Text fontSize="md"><strong>Faizan Hussain</strong></Text>
                <Text fontSize='sm'>About me</Text>
                <Text fontSize="sm"><strong>Follow</strong></Text>
            </Box>
        </VStack>
    );
}

export default Blog_sidebar;