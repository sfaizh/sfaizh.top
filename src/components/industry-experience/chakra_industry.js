import React, { useEffect, useState } from 'react';
import "../industry-experience/industry.css";
import Footer from "../common/footer.js";
import Header from "../common/chakra_header.js";
import Sidebar from "../common/sidebar/sidebar.js";
import Card from "../common/content/card.js";
import posts from "../../assets/data/posts.json";
import "../common/content/card.css";

import Industry_card from "../industry-experience/industry-card.js";
import { IconButton } from "@chakra-ui/button";
import { useColorMode } from "@chakra-ui/color-mode";
import { Show, Hide } from '@chakra-ui/react'
import { VStack, HStack, Flex, Box, Heading, Spacer, Text, Divider } from "@chakra-ui/layout";
import { FaSun, FaMoon, FaInstagram, FaGithub, FaLinkedin } from "react-icons/fa";
import {
    List,
    ListItem,
    ListIcon,
    OrderedList,
    UnorderedList,
    Highlight,
    Image
} from '@chakra-ui/react'
import axios from "axios";
import deployment from "../../deployment.json";

let _isMounted = false;

const Industry = () => {
    const [posts, setPosts] = useState( null );

    const getPosts = () => {
        // Set loading modifiers
        // props.setLoadingState(true);
        // props.setLoadingState(false);
        axios.get(deployment.production + "/posts")
            .then(r => {
                setPosts(r);
                // props.setLoadingState(false);
            })
            .catch(err => console.log(err));
    }

    useEffect(()  => {
        getPosts();
    }, []);

    if (!posts) return null;

    return (
        <VStack p={5}>
            <Header/>
            <Flex w='100%' p={10}>
                <VStack>
                    <Heading pb={2} align="center" as="h1" size="4xl">Industry Experience</Heading>
                        {/* { (logoMode == "dark") ? <Box className="blog-banner" pb="0px" align="center"></Box> : <Box className="blog-banner-dark" pb="0px" align="center"></Box>} */}
                        {/* <Box className="blog-banner" pb="0px" align="center"></Box> */}
                        <Text pb={3} align="center" fontSize="sm">My Industry experience over the last 5 years</Text>
                    <Divider />
                    <HStack pt={10} align="flex-start">
                        <Show breakpoint="(min-width: 750px)">
                            <Box pr={20}>
                                {/* <Heading size="lg" lineHeight='tall'>
                                    <Highlight query="Industry" styles={{ bg: 'black', color: "white", px: '2', py: '1.5' }}>
                                        Industry Experience
                                    </Highlight>
                                </Heading> */}
                                <UnorderedList styleType="none" spacing="10px" m="0">
                                    {posts.data.map(function(data, i) {
                                        return <ListItem key={i}>{data.title}</ListItem>
                                    })}
                                </UnorderedList>
                            </Box>
                        </Show>
                        <VStack w="100%" align="stretch">
                            {/* https://via.placeholder.com/300 */}
                            {posts.data.map(function(data, i) {
                                return <Industry_card key={i} card={ data } />
                            })}
                            {/* <Industry_card card={{ logo: "/img/cisco-logo.jpg", title: "Technical Solutions Specialist", subtitle: "Cisco Infrastructure Software Group (Data Center)", description: "The Technical Solutions Specialist's (TSS) primary responsibility is to provide technical guidance and sales support on the Cisco CISG (Data Center) Portfolio and how technical solutions can be applied to solve business problems.", footer: "Cisco (Aug 2022 - Present)" }} /> */}
                        </VStack>
                    </HStack>
                </VStack>
            </Flex>
            <Footer/>
        </VStack>
    )

}

export default Industry;