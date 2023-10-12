import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text } from "@chakra-ui/layout";
import { useMediaQuery, Button, Image } from "@chakra-ui/react";
import ChakraCarousel from "./carousel.js"
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import posts from "../../assets/data/blogs.json";
import "../home/home.css";

import {
    Container,
    Tag
  } from "@chakra-ui/react";

function muteMusic() {
    return 0;
}

const Banner = props => {
    const { toggleMusic } = muteMusic();

    const [isLargerScreen] = useMediaQuery("(min-width: 600px");

    const [data, setData] = useState([]);

    // useEffect(() => {
    //   fetch("https://jsonplaceholder.typicode.com/posts/")
    //     .then((res) => res.json())
    //     .then((res) => setData(res));
    // }, []);
    useEffect(() => {
        setData(posts.posts);
    }, []);


    return (
            <Container
                py={8}
                px={0}
                maxW={{
                base: "100%",
                sm: "35rem",
                md: "43.75rem",
                lg: "57.5rem",
                xl: "75rem",
                xxl: "87.5rem"
                }}
            >
                <Stack className="banner-wide" pb="50px">
                    <Box pb="0px" pt="50" align="center">
                        <Image
                            borderRadius="full"
                            src="assets/img/banner-logo.jpg"
                            alt="me"
                            boxSize="150"/>
                    </Box>
                    <Flex direction={isLargerScreen ? "row" : "column"}
                        p={isLargerScreen ? "32" : "0"}
                        alignSelf="flex-start" pt="10px" pb="10px">
                        <Box p="5" backgroundColor="rgb(39,55,55, 0.3)" mt={isLargerScreen ? "0" : 16} align="center">
                            <Text color="white" fontSize="5xl" fontWeight="semibold">Welcome to my site</Text>
                            <Text color="white">I've put together this quick collection of artefacts to share. Mostly random things associated with my life or something that I'm working on documenting.</Text>
                            {/* <Button mt={8} colorScheme="blue" onClick={toggleMusic}>Mute music</Button> */}
                        </Box>
                    </Flex>
                </Stack>
            </Container>
    );
}

export default Banner;