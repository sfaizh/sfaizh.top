import Banner from "./home/banner_chakra.js";
import Footer from "./common/footer.js";
import Header from "./common/chakra_header.js";

import { useMediaQuery, Button, Image } from "@chakra-ui/react";

import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Center } from "@chakra-ui/layout";
import React, { useState, useEffect } from "react";
import "./home/home.css";
import axios from "axios";
import deployment from "../deployment.json";
import { useNavigate, Link, useParams } from 'react-router-dom';

import {
    Container,
    Tag
} from "@chakra-ui/react";

const About = () => {
    const [isLargerScreen] = useMediaQuery("(min-width: 600px");

    return (
        <VStack p={5}>
            <Header/>
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
                        <Text fontSize="4xl" fontWeight="semibold">About Me</Text>
                        <Text fontSize='md'>
                            Hi! 👋 I'm Faizan.
                        </Text>
                        <Text>
              I'm Faizan, an aspiring Software Engineer. I'm Ex-cisco and have worked as a systems engineer on their data center and cloud portfolio. Currently I am working at Datadog supporting their observability platform, in the APM team.
                        </Text>
                        <Text>
                            I run a blog, where I write about cars, motorbikes, and basically anything that rolls on wheels. I also enjoy travelling and powerlifting in no particular order :)
                        </Text>
                        <Text>
                            I grew up in South-West Sydney Australia 🇦🇺 and completed my software engineering degree at University of Technology, Sydney.
                        </Text>
                        <Text>
                            I try to write whenever I have the chance. If you read something you like, feel free to share it!
                        </Text>
                    </Box>
                </Flex>
            </Container>
            <Footer/>
        </VStack>
    )
}

export default About;
