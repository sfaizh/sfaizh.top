const Metadata = (markdown) => {
    if (!markdown)
        return null
    else {
        const charactersBetweenGroupedHyphens = /^---([\s\S]*?)---/;
        const metadataMatched = markdown.match(charactersBetweenGroupedHyphens);
        console.log(metadataMatched)
        if (!metadataMatched)
            return null
        const metadata = metadataMatched[1];

        if (!metadata) {
            return {};
        }

        const metadataLines = metadata.split("\n");
        const metadataObject = metadataLines.reduce((accumulator, line) => {
            const [key, ...value] = line.split(":").map((part) => part.trim());

            if (key)
                accumulator[key] = value[1] ? value.join(":") : value.join("");
            return accumulator;
        }, {});

        return metadataObject;
    }
}

export default Metadata