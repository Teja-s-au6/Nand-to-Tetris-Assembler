const fs = require("node:fs");
const path = require("path");

// Get the file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error("Please provide a file path.");
  process.exit(1);
}

const compTable = {
  0: {
    // a = 0
    0: "101010",
    1: "111111",
    "-1": "111010",
    D: "001100",
    A: "110000",
    "!D": "001101",
    "!A": "110001",
    "-D": "001111",
    "-A": "110011",
    "D+1": "011111",
    "A+1": "110111",
    "D-1": "001110",
    "A-1": "110010",
    "D+A": "000010",
    "D-A": "010011",
    "A-D": "000111",
    "D&A": "000000",
    "D|A": "010101",
  },
  1: {
    // a = 1
    M: "110000",
    "!M": "110001",
    "-M": "110011",
    "M+1": "110111",
    "M-1": "110010",
    "D+M": "000010",
    "D-M": "010011",
    "M-D": "000111",
    "D&M": "000000",
    "D|M": "010101",
  },
};

const dest = {
  null: "000",
  M: "001",
  D: "010",
  MD: "011",
  A: "100",
  AM: "101",
  AD: "110",
  ADM: "111",
};

const jumpTable = {
  null: "000",
  JGT: "001",
  JEQ: "010",
  JGE: "011",
  JLT: "100",
  JNE: "101",
  JLE: "110",
  JMP: "111",
};

let symbolTable = {
  R0: 0,
  R1: 1,
  R2: 2,
  R3: 3,
  R4: 4,
  R5: 5,
  R6: 6,
  R7: 7,
  R8: 8,
  R9: 9,
  R10: 10,
  R11: 11,
  R12: 12,
  R13: 13,
  R14: 14,
  R15: 15,
  SCREEN: 16384,
  KBD: 24576,
  SP: 0,
  LCL: 1,
  ARG: 2,
  THIS: 3,
  THAT: 4,
};

function outputFileWithExtension(data, filename, extension) {
  const fullPath = path.join(__dirname, `${filename}.${extension}`);

  fs.writeFile(fullPath, data, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log(`File ${filename}.${extension} written successfully!`);
    }
  });
}

function toBinaryString(num, bits) {
  let binary = num.toString(2);
  while (binary.length < bits) {
    binary = "0" + binary;
  }
  return binary;
}

function covertAInstruction(filteredLines) {
  let memValue = 16;
  let symValue = 0;
  let processedData = filteredLines?.map((line, index) => {
    if (line?.startsWith("@")) {
      const splittedWords = line.split("@")?.map((e) => e.trim());
      if (splittedWords[1] in symbolTable) {
        return `@${symbolTable[splittedWords[1]]}`;
      } else {
        return line;
      }
    } else if (line.startsWith("(") && line.endsWith(")")) {
      const modifiedWord = line.slice(1, -1);
      symbolTable[modifiedWord] = index - symValue;
      symValue++;
      return line;
    } else {
      return line;
    }
  });

  processedData = processedData?.map((line, index) => {
    if (line?.startsWith("@")) {
      const splittedWords = line.split("@")?.map((e) => e.trim());
      if (splittedWords[1] in symbolTable) {
        return `@${symbolTable[splittedWords[1]]}`;
      } else if (
        splittedWords[1] &&
        [...splittedWords[1]].some(
          (char) => char === char.toLowerCase() && char !== char.toUpperCase()
        )
      ) {
        symbolTable[splittedWords[1]] = memValue;
        memValue++;
        return line;
      } else {
        return line;
      }
    } else {
      return line;
    }
  });

  processedData = processedData?.map((line) => {
    if (line?.startsWith("@")) {
      const splittedWords = line.split("@")?.map((e) => e.trim());
      const aNumber =
        symbolTable[splittedWords[1]] !== undefined &&
        symbolTable[splittedWords[1]] !== null
          ? symbolTable[splittedWords[1]]
          : Number(splittedWords[1]);
      return `0${toBinaryString(aNumber, 15)}`;
    } else {
      return line;
    }
  });

  const unresolvedSymbols = processedData.some((line) => line.startsWith("@"));

  if (unresolvedSymbols) {
    return covertAInstruction(processedData); // Recursively process again
  }
  return processedData?.filter((line) => !line.trim()?.startsWith("("));
}

function convertCInstruction(filteredLines) {
  return filteredLines?.map((line) => {
    if (line?.includes("=") || line?.includes(";")) {
      // c-binary = 1 1 1 a c c c c c c d d d j j j
      const splitJumpandDestValue = (value, aBinary) => {
        const splitValue = value?.split(";");
        const cBinary = compTable?.[aBinary][splitValue[0]];
        const jmpBinary = jumpTable?.[splitValue[1]];
        return `111${aBinary}${cBinary}000${jmpBinary}`;
      };

      const splitCandJumpValue = (value) => {
        const splitValue = value?.split(";");
        const jmpBinary = jumpTable?.[splitValue[1]];
        return `${jmpBinary}`;
      };
      const equalSpliteValue = line?.split("=")?.map((e) => e.trim());
      const startBinary = "111";
      const aBinary = equalSpliteValue[0]?.includes(";")
        ? 0
        : compTable[0][equalSpliteValue[1]]
        ? 0
        : compTable[1][equalSpliteValue[1]]
        ? 1
        : 0;
      const cBinary = equalSpliteValue[1]
        ? compTable?.[aBinary][equalSpliteValue[1]]
        : "000000";
      const dBinary = !equalSpliteValue[0]?.includes(";")
        ? dest[equalSpliteValue[0]]
        : "000";
      const jmpBinary = equalSpliteValue[1]?.includes(";")
        ? splitCandJumpValue(equalSpliteValue[1])
        : "000";
      const finalBinary = equalSpliteValue[0]?.includes(";")
        ? splitJumpandDestValue(equalSpliteValue[0], aBinary)
        : `${startBinary}${aBinary}${cBinary}${dBinary}${jmpBinary}`;
      return finalBinary;
    } else {
      return line;
    }
  });
}

// Read the file
fs.readFile(filePath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading file:", err);
    return;
  }

  // Removing empty lines and comments
  const linesArray = data.split("\n");
  let filteredLines = linesArray
    .filter((line) => line.trim() !== "" && !line.trim()?.startsWith("//"))
    ?.map((e) => e.trim());

  filteredLines = covertAInstruction(filteredLines);
  filteredLines = convertCInstruction(filteredLines);
  const updatedContent = filteredLines.join("\n");
  const dataToWrite = updatedContent;
  outputFileWithExtension(dataToWrite, "", "hack");
});
