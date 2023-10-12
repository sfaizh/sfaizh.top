import React, { useEffect, useState } from 'react';
import "../industry-experience/industry.css";
import "../common/content/card.css";

import { VStack, HStack, Flex, Box, Heading, Spacer, Text } from "@chakra-ui/layout";
import {
    Image
} from '@chakra-ui/react'
import Markdown from "react-remarkable";

const Industry_card = props => {

    return (

    <Box pb={10}>
        {/* Test api fill */}
        <HStack pb={5}>
            {/* replace img src */}
            <Image src={props.card.logo} width="75px" />
            <VStack pl={3} alignItems="left">
                <Heading size="md">{props.card.title}</Heading>
                <Heading size="xs" pb={5}>{props.card.subtitle}</Heading>
            </VStack>
        </HStack>
        <Markdown>{props.card.description}</Markdown>
        <Text pt={5} fontSize={13}>{props.card.footer}</Text>
    </Box>

    );
}

export default Industry_card;