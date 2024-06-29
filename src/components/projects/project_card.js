import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Divider } from "@chakra-ui/layout";
import { useMediaQuery, Button, Image, Show } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import "../home/home.css";
import Markdown from "react-remarkable";
import { Link } from 'react-router-dom';
import Metadata from "../../utils/metadata";
import readingTime from "reading-time";

import {
    Container,
    Tag
} from "@chakra-ui/react";

const Project_card = props => {
    const [isScreenLarge] = useMediaQuery("(min-width: 750px");

    return (
        <VStack align="left">
            <HStack align="left">
                {/* <Image width="120px" src={props.card.logo} /> */}
                <VStack align="left">
                    <Link to={props.card.git_uri}>
                        <Box w="100%">
                            <Text fontWeight='700' fontSize='xl' mb={0}>{props.card.title}</Text>
                        </Box>
                    </Link>
                    <Box>
                        <Text>{props.card.subtitle}</Text>
                    </Box>
                </VStack>
            </HStack>
            <Divider />
        </VStack>
    );
}

export default Project_card;