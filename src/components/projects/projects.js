import Banner from "../home/banner_chakra.js";
import Footer from "../common/footer.js";
import Header from "../common/chakra_header.js";

import { useMediaQuery, Button, Image } from "@chakra-ui/react";

import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Center } from "@chakra-ui/layout";
import React, { useState, useEffect } from "react";
import "../home/home.css";
import axios from "axios";
import deployment from "../../deployment.json";
import { useNavigate, Link, useParams } from 'react-router-dom';
import Project_card from "./project_card.js";
import projects from "../../assets/data/projects.json";

import {
    Container,
    Tag
} from "@chakra-ui/react";

const Projects = () => {
    const [isLargerScreen] = useMediaQuery("(min-width: 600px");
    const [posts, setPosts] = useState(null);

    useEffect(() => {
        setPosts(projects.posts);
    }, [projects]);

    if (!posts) return null;

    return (
        <VStack p={5}>
            <Header />
            <Container
                py={8}
                px={0}
                maxW={{
                    base: "100%",
                    sm: "35rem",
                    md: "43.75rem",
                    lg: "57.5rem",
                    xl: "75rem",
                    xxl: "77.5rem"
                }}
            >
                <Flex pt={5} alignContent={"center"} justifyContent={"center"}>
                    <Box align="left" width={{ base: "100%", md: "100%", lg: "60%" }}>
                        <Text fontSize="4xl" fontWeight="semibold">Software Projects</Text>
                        {
                            posts.map(function (data, i) {
                                return <Project_card key={i} card={data} />
                            })
                        }
                    </Box>
                </Flex>
            </Container>
            <Footer />
        </VStack>
    )
}

export default Projects;