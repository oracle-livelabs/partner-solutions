# High-Level Quantum Computing in Java

## Introduction

**Strange** is a Java library for quantum computing. 

* **Strange** contains a high-level API in the class `org.redfx.strange.algorithm.Classic`. This API has  a number of functions that benefit from quantum computing, without exposing the low-level quantum computing details.
* **Strange** also contains a low-level API that allows Java developers to create quantum applications using quantum computing details (by using quantum gates).

Classical computers work with bits: 0 and 1. But quantum computers work with qubits: 0, 1, and combinations (superpositions) of 0 and 1. Even so, when we measure a qubit, we always see either 0 or 1.

This step’s code puts a qubit into a half-0-half-1 superposition state, and then measures the qubit to get 0 or 1. Approximately half the time, the measurement yields 0, and the rest of the time, the measurement yields 1. If you were running this code several times on a real quantum computer, the sequence of 0/1 outputs you’d get would be truly random.


Estimated Time: 20 minutes

### Objectives

In this lab, you will:
* Run high-level quantum computing code in Java to generate random bits.


## Task 1: Install the required software

1. Visit [https://www.jbang.dev/documentation/guide/latest/installation.html](https://www.jbang.dev/documentation/guide/latest/installation.html) and follow the instructions for installing JBang.

	JBang provides an easy way to run Java code without having to set up dependencies.

2. Visit [https://github.com/johanvos/qkd-java](https://github.com/johanvos/qkd-java) to get this lab’s code examples.

   You’ll find the Java code examples in the folder `qkd-java/jbang`.

## Task 2: Run the code

1. Examine the Java code in the file `RandomNumber.java`.

	```
	<copy>
	//usr/bin/env jbang "$0" "$@" ; exit $?
	//DEPS org.redfx:strange:0.1.1
	
	import org.redfx.strange.algorithm.Classic;
	
	public class RandomNumber {
	
		public static void main (String[] args) {
			int randomBit = Classic.randomBit();
			System.out.println
				("Generate one random bit, " + 
				 "which can be 0 or 1. Result = " + randomBit);
		}
	}
	</copy>
    ```

2. Run the code with the command `jbang RandomNumber.java`.

   Examine the code's output.

## Task 3: Modify the code

1. Enclose both of the main method’s statements in a loop to run them a number of time. Find the proportion of `Classic.randomBit` calls that produce 0 vs. 1.

   You'll find a solution at the end of these workshop materials.

## Learn More

* [Strange API documentation](https://redfx-quantum.github.io/strange/apidocs/)

## Acknowledgements
* **Authors** - Johan Vos, Co-Founder of Gluon HQ; Barry Burd, Professor at Drew University
* **Last Updated By/Date** - Barry Burd, October 2022


