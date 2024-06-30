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

function trim(str, maxLen, separator = ' ') {
    if (str.length <= maxLen) return str;
    return str.substr(0, str.lastIndexOf(separator, maxLen));
}

const Blog_card = props => {

    const [data, setData] = useState([]);
    const [isScreenLarge] = useMediaQuery("(min-width: 750px");
    const [tags, setTags] = useState([]);
    const [date, setDate] = useState('');
    const [content, setContent] = useState('');

    useEffect(() => {
        if (props.card) {
            setTags(props.card.tags.split(' '))
            setDate(props.card.date.split('T')[0])
            setContent(props.card.description);
        }
    }, []);

    return (
        <VStack>
            <Box align="left" w="100%">
                <Heading fontWeight='700' as='h1' mb={0}>{props.card.title}</Heading>
            </Box>
            {/* <Box align="center" w="100%">
                <Text fontSize="sm">{props.card.subtitle}</Text>
            </Box> */}
            <HStack width="100%">
                <Box align="left" w="100%">
                    <Text fontSize="md">{date}</Text>
                </Box>
                <Box align="right" w="100%">
                    <Text fontSize="md">{readingTime(content).text}</Text>
                </Box>
            </HStack>
            {/* <Box align="left" w="100%">
                <Text fontSize="sm">{Metadata(props.card.description)}</Text>
            </Box> */}
            <Box align="center" w="100%" pb={6}>
                <Link to={"/view/" + props.card._id}>
                    <Image src={props.card.images.main} />
                </Link>
            </Box>
            <br />
            <Box w="100%">
                {/* Check mode */}
                {
                    (props.mode != "all") ?
                        <Box fontSize='lg'>
                            <Markdown source={props.card.description} />
                        </Box>
                        :
                        <Box>
                            <Markdown source={trim(props.card.description, 100)} />
                            <Text>...</Text>
                            <br /><br />
                            <Link to={"/view/" + props.card._id}>
                                <Button
                                    colorScheme="gray"
                                    size="sm">Continue reading
                                </Button>
                            </Link>
                        </Box>
                }
            </Box>
            <Spacer pt={20} />
            <Box w="100%">
                {
                    (props.mode != "all") ? (
                        <VStack>
                            <Box align="left" w="100%">
                                <Text color='#cacbce'>
                                    {
                                        tags.map(function (data, i) {
                                            // Quick private function here - change when possible in backend
                                            return `#${data} `
                                        })
                                    }
                                </Text>
                            </Box>
                            <Spacer />
                            <VStack w="100%" align="left" spacing="0px" pb={10}>
                                <Box w="100%">
                                    <Text fontSize="sm">{props.card.author}</Text>
                                </Box>
                                <Box w="100%">
                                    <Text fontSize="sm">{date}</Text>
                                </Box>
                            </VStack>
                        </VStack>

                    ) : null
                }
            </Box>

            <Divider />
        </VStack>
    );
}

export default Blog_card;