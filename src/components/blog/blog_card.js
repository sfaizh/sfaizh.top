import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Divider } from "@chakra-ui/layout";
import { useMediaQuery, Button, Image, Show } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import "../home/home.css";
import Markdown from "react-remarkable";
import { Link } from 'react-router-dom';

import {
    Container,
    Tag
} from "@chakra-ui/react";

function trim(str, maxLen, separator = ' ') {
    if (str.length <= maxLen) return str;
    return str.substr(0, str.lastIndexOf(separator, maxLen));
}

const Blog_card = props => {

    const [data, setData] = useState([]);
    const [isScreenLarge] = useMediaQuery("(min-width: 750px");

    useEffect(() => {

    }, []);

    return (
        <VStack p={3}>
            <Box align="center" w="100%">
                <Text fontSize="4xl">{props.card.title}</Text>
            </Box>
            <Box align="center" w="100%">
                <Text fontSize="sm">{props.card.subtitle}</Text>
            </Box>
            <Box align="center" w="100%">
                <Link to={"/view/" + props.card._id}>
                    <Image src={props.card.images.main} />
                </Link>
            </Box>
            <br />
            <Box w="100%">
                {/* Check mode */}
                {
                    (props.mode != "all") ?
                        <Box>
                            <Markdown source={props.card.description} />
                        </Box>
                        :
                        <Box>
                            <Markdown source={trim(props.card.description, 100)} />
                            ...
                            <br /><br />
                            <Link to={"//view/" + props.card._id}>
                                <Button
                                    colorScheme="gray"
                                    size="sm">More
                                </Button>
                            </Link>
                        </Box>
                }
            </Box>

            {
                (props.mode != "all") ? (
                    <VStack>
                        <Box align="center" w="100%">
                            Tags: {props.card.tags}
                        </Box>
                        <Spacer />
                        <VStack w="100%" align="left" spacing="0px" pb={10}>
                            <Box w="100%">
                                <Text fontSize="sm">{props.card.author}</Text>
                            </Box>
                            <Box w="100%">
                                <Text fontSize="sm">{props.card.date}</Text>
                            </Box>
                        </VStack>
                    </VStack>

                ) : null
            }

            <Divider />
        </VStack>
    );
}

export default Blog_card;