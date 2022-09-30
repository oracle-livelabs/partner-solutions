# High-Level Quantum Computing in Java

## Introduction

A key difference between a classical bit and a qubit is that the qubit can be in a superposition state, which is a combination of the 0 state and the 1 state, until the qubit is measured. Once measured, the qubit is only in a single state: either 0, or 1.

A special gate, called the Hadamard gate, brings a qubit into this superposition state.

Some features of the low-level API in Strange:
* A quantum `Program` defines a number of `Step` instances that are executed sequentially by a `QuantumExecutionEnvironment`. (By default, this is a quantum computer simulator.)
* A `Step` instance contains quantum `Gate` instances. Each `Gate` instance operates on one or more qubits.
* Quantum `Gate` instances are like classical gates (e.g. NOT, OR, AND), but quantum gates perform operations on qubits. . 
* Obtaining the result of a quantum program is done by calling the `getResult()` method on the `Program` instance, retrieving the qubits from the result, and measuring the qubit. 
* The **Strange** library has a companion library, **StrangeFX**, which contains tools to visualize quantum circuits created with Strange. 



Estimated Time: 20 minutes

### Objective

In this lab, you will:
* Run low-level quantum computing code in Java to generate random bits.


## Task 1: A random number generator that uses quantum gate logic

1. Use jbang to run `LowLevelRandom.java` a few times, and note each run’s output.

2. Examine the `LowLevelRandom.java` code.

   ```
   <copy>
   //usr/bin/env jbang "$0" "$@" ; exit $?
   //DEPS org.redfx:strange:0.1.1
   //DEPS org.redfx:strangefx:0.1.4
 
   import org.redfx.strange.Gate;
   import org.redfx.strange.Program;
   import org.redfx.strange.Qubit;
   import org.redfx.strange.Result;
   import org.redfx.strange.Step;
   import org.redfx.strange.QuantumExecutionEnvironment;
   import org.redfx.strange.gate.Hadamard;
   import org.redfx.strange.gate.X;
   import org.redfx.strange.local.SimpleQuantumExecutionEnvironment;
   import org.redfx.strangefx.render.Renderer;
  
   public class LowLevelRandom {
 
       public static void main (String[] args) {
 
           // Create a simulated quantum computer.
           QuantumExecutionEnvironment simulator = new SimpleQuantumExecutionEnvironment();
 
           // Create a quantum program with 1 qubit.
           Program program = new Program(1);
 
           // Add a step to the program.
           // In this step, the 0-indexed qubit has a Hadamard gate.
           Step step = new Step();
           step.addGate(new Hadamard(0));
           program.addStep(step);
 
           // Run the program and display the results.
           Result result = simulator.runProgram(program);
           Qubit[] qubits = result.getQubits();        
           System.out.println("Value: " + qubits[0].measure());
           System.out.println("Probability of being 1: " + qubits[0].getProbability());
 
           // Display the circuit.
           Renderer.renderProgram(program);
       }
   }
   </copy>
   ```

3. Add a loop to `LowLevelRandom.java` to find the proportion of Program runs that produce 0 vs. 1.

   You'll find a solution at the end of these workshop materials.



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
                ("Generate one random bit, which can be 0 or 1. Result = "+randomBit);
        }
    }
    </copy>
    ```

2. Run the code with the command `jbang RandomNumber.java`.

   Examine the code's output.

## Task 3: Modify the code

1. Enclose both of the main method’s statements in a loop to run them a number of times. Find the proportion of `Classic.randomBit` calls that produce 0 vs. 1.

   You'll find a solution at the end of these workshop materials.


