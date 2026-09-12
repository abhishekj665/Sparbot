import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import Question from "../models/Question.model.js";

const questions = [
  {
    sourceId: "easy-sum-two-integers",
    difficulty: "Easy",
    title: "Sum Two Integers",
    topics: ["Math", "Input and Output"],
    description: "Read two integers from standard input and print their sum. Input contains two space-separated integers. Output one integer: their sum. Values may be negative.",
    starterCode: { java: `import java.util.*;

class Solution {
  public int add(int first, int second) {
    // Return the sum of first and second.
    return 0;
  }
}

public class Main {
  public static void main(String[] args) {
    Scanner input = new Scanner(System.in);
    int first = input.nextInt();
    int second = input.nextInt();
    System.out.println(new Solution().add(first, second));
  }
}` },
    inputOutput: [
      { input: "2 8", output: "10" },
      { input: "-4 7", output: "3" },
    ],
  },
  {
    sourceId: "medium-largest-number",
    difficulty: "Medium",
    title: "Largest Number in a List",
    topics: ["Arrays", "Iteration"],
    description: "Read an integer n followed by n integers. Print the largest number. Input always contains at least one number.",
    starterCode: { java: `import java.util.*;

class Solution {
  public int findLargest(int[] numbers) {
    // Return the largest value in numbers.
    return 0;
  }
}

public class Main {
  public static void main(String[] args) {
    Scanner input = new Scanner(System.in);
    int n = input.nextInt();
    int[] numbers = new int[n];
    for (int index = 0; index < n; index++) numbers[index] = input.nextInt();
    System.out.println(new Solution().findLargest(numbers));
  }
}` },
    inputOutput: [
      { input: "5\n3 9 2 7 4", output: "9" },
      { input: "3\n-8 -1 -5", output: "-1" },
    ],
  },
  {
    sourceId: "hard-count-even-values",
    difficulty: "Hard",
    title: "Count Even Values",
    topics: ["Arrays", "Conditions"],
    description: "Read an integer n followed by n integers. Print how many of the integers are even. Zero is even and n may be zero.",
    starterCode: { java: `import java.util.*;

class Solution {
  public int countEven(int[] values) {
    // Return how many values are even.
    return 0;
  }
}

public class Main {
  public static void main(String[] args) {
    Scanner input = new Scanner(System.in);
    int n = input.nextInt();
    int[] values = new int[n];
    for (int index = 0; index < n; index++) values[index] = input.nextInt();
    System.out.println(new Solution().countEven(values));
  }
}` },
    inputOutput: [
      { input: "6\n1 2 3 4 5 6", output: "3" },
      { input: "0", output: "0" },
    ],
  },
];

try {
  await connectDb();
  for (const question of questions) {
    await Question.updateOne(
      { source: "sparbot-starter", sourceId: question.sourceId },
      { $set: { ...question, source: "sparbot-starter", datasetSplit: "train", assessment: { enabled: true, allowedLanguages: ["java"] } } },
      { upsert: true },
    );
  }
  console.log(`Added or updated ${questions.length} starter questions.`);
} catch (error) {
  console.error(`Could not seed questions: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close();
}
