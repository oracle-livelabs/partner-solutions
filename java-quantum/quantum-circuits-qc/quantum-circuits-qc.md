# Creating Quantum Circuits

## Introduction

The program in the previous exercise passes one qubit through one quantum gate to create a random bit. A typical quantum computing program uses many qubits, with each qubit passing though many gates. When a qubit passes through many gates, each of the gates belongs to an instance of the `Step` class. 

Estimated Time: 25 minutes

### Objective

In this lab, you will:
* Run code that involves multiple qubits and multiple steps.
* Experiment with code that involves multiple steps.

## Task 1: Run the sample code

1. Run the code shown below.

    You'll find this code in the file `MultiQubit_MultiStep.java`. 

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
  
   public class MultiQubit_MultiStep {
 
       public static void main (String[] args) {
 
           // Create a simulated quantum computer.
           QuantumExecutionEnvironment simulator = new SimpleQuantumExecutionEnvironment();
 
           // Create a quantum program with 2 qubit2.
           Program program = new Program(2);
 
           // Add a step to the program.
           // In this step, the 0-indexed qubit has a Hadamard gate.
           Step step = new Step();
           step.addGate(new Hadamard(0));
           program.addStep(step);
 
           // Add another step to the program.
           // In this step, both qubits have NOT gates.
           Step stepB = new Step();
           stepB.addGate(new X(0));
           stepB.addGate(new X(1));
           program.addStep(stepB);
 
           // Run the program and display the results.
           Result result = simulator.runProgram(program);
           Qubit[] qubits = result.getQubits();        
           for (int i = 0; i < 2; i++) {
               System.out.println("qubit " + i);
               System.out.println("    value: " + qubits[i].measure());
               System.out.println("    probability of being 1: " +
                                       qubits[i].getProbability());
           }
 
           // Display the circuit.
           Renderer.renderProgram(program);
       }
   }
   </copy>
   ```
2. Compare the code with the output of the run.

   What conclusions can you draw about creating circuits with Strange?

## Task 2: Experiment with quantum gates

1. Make a copy of the code in `LowLevelRandom.java` from Task 1 in this workshop's Low-Level Quantum Computing in Java section.

2. Modify the code in various ways to discover the effects of X gates and Hadamard gates on qubits. For each ciruit, observe the observe the value that you get when you measure the run's result. Draw conclusions based on your observations.

   Here are some cirtuis to try building:

   1. A circuit with two X gates:

   ![Image: Two X gates](./images/xx.png)

   2. An X gate followed by an H gate:

   ![Image: X gate followed by H gate](./images/xh.png)

   3. Two H gates:

   ![Image: Two H gates](./images/hh.png)

   4. An X gate followed by two H gates:

   ![Image: X gate followed by two H gates](./images/xhh.png)

   5 An X gate between two H gates:

   ![Image: X gate between two H gates](./images/hxh.png)

   You'll find solutions at the end of these workshop materials.
