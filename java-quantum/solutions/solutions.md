# Solutions

## Introduction

This page has solutions to the workshop exercises.

## High-Level Quantum Computing in Java - Task 3

```
<copy>
//usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS org.redfx:strange:0.1.1

import org.redfx.strange.algorithm.Classic;

public class RandomNumbers {

    public static void main (String[] args) {
        int randomBit;
        int zeros = 0, ones = 0;
        for (int i = 0; i < 1000; i++) {
            randomBit = Classic.randomBit();
            if (randomBit == 0)
                zeros++;
            else
                ones++;
        }
        System.out.println(zeros + " 0s and " + ones + " 1s");
    }
}
</copy>
```

## Low-Level Quantum Computing in Java - Task 3

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
 
 
public class LowLevelRandoms {
 
    public static void main (String[] args) {
        int zeros = 0, ones = 0;
 
        // Create a simulated quantum computer.
        QuantumExecutionEnvironment simulator
                = new SimpleQuantumExecutionEnvironment();

        for (int i = 0; i < 1000; i++) {

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
            if (qubits[0].measure() == 0)
                zeros++;
            else
                ones++;
        }

        System.out.println(zeros + " 0s and " + ones + " 1s");
    }
}
</copy>
```

## Creating Quantum Circuits - Task 2

1. The output is always 0 because 

    * The qubit starts off as a 0 by default.
    * The second X gate cancels out the first X gate.

    ```
    <copy>
    //usr/bin/env jbang "$0" "$@" ; exit $?
    //DEPS org.redfx:strange:0.1.1
    //DEPS org.redfx:strangefx:0.1.4


    import org.redfx.strange.*;
    import org.redfx.strange.QuantumExecutionEnvironment;
    import org.redfx.strange.gate.*;
    import org.redfx.strange.local.SimpleQuantumExecutionEnvironment;
    import org.redfx.strangefx.render.Renderer;


    public class Experiments {

        public static void main (String[] args) {
            QuantumExecutionEnvironment simulator = new SimpleQuantumExecutionEnvironment();

            Program program = new Program(1);
            Step step = new Step();
            step.addGate(new X(0));
            program.addStep(step);

            Step step2 = new Step();
            step2.addGate(new X(0));
            program.addStep(step2);

            Result result = simulator.runProgram(program);
            Qubit[] qubits = result.getQubits();
            Qubit zero = qubits[0];
            int value = zero.measure();
            System.out.println("After running the program, its measured state = "+value);

            Renderer.renderProgram(program);
        }
    }
    </copy>
    ```

2. The output is 0 approximately half the time and 1 approximately half the time because


    * The qubit starts off as a 0 by default.
    * The X gate puts the qubit into the 1 state.
    * After applying a Hadamard gate to a qubit in the 1 state, you have a 50:50 change of measuring either 0 or 1.

    ```
    <copy>
    //usr/bin/env jbang "$0" "$@" ; exit $?
    //DEPS org.redfx:strange:0.1.1
    //DEPS org.redfx:strangefx:0.1.4


    import org.redfx.strange.*;
    import org.redfx.strange.QuantumExecutionEnvironment;
    import org.redfx.strange.gate.*;
    import org.redfx.strange.local.SimpleQuantumExecutionEnvironment;
    import org.redfx.strangefx.render.Renderer;


    public class Experiments {

        public static void main (String[] args) {
            QuantumExecutionEnvironment simulator = new SimpleQuantumExecutionEnvironment();

            Program program = new Program(1);
            Step step = new Step();
            step.addGate(new X(0));
            program.addStep(step);

            Step step2 = new Step();
            step2.addGate(new Hadamard(0));
            program.addStep(step2);

            Result result = simulator.runProgram(program);
            Qubit[] qubits = result.getQubits();
            Qubit zero = qubits[0];
            int value = zero.measure();
            System.out.println("After running the program, its measured state = "+value);

            Renderer.renderProgram(program);
        }
    }
    </copy>
    ```

3. The output is always 0 because 

    * The qubit starts off as a 0 by default.
    * The Hadamard gate is its own inverse. Applying Hadamard the second time in a row undoes the first application of the Hadamard gate.

    ```
    </copy>
    //usr/bin/env jbang "$0" "$@" ; exit $?
    //DEPS org.redfx:strange:0.1.1
    //DEPS org.redfx:strangefx:0.1.4


    import org.redfx.strange.*;
    import org.redfx.strange.QuantumExecutionEnvironment;
    import org.redfx.strange.gate.*;
    import org.redfx.strange.local.SimpleQuantumExecutionEnvironment;
    import org.redfx.strangefx.render.Renderer;


    public class Experiments {

        public static void main (String[] args) {
            QuantumExecutionEnvironment simulator = new SimpleQuantumExecutionEnvironment();

            Program program = new Program(1);
            Step step = new Step();
            step.addGate(new Hadamard(0));
            program.addStep(step);

            Step step2 = new Step();
            step2.addGate(new Hadamard(0));
            program.addStep(step2);

            Result result = simulator.runProgram(program);
            Qubit[] qubits = result.getQubits();
            Qubit zero = qubits[0];
            int value = zero.measure();
            Renderer.renderProgram(program);
        }
    }
    </copy>
```

4. The output is always 1 because 

    * The qubit starts off as a 0 by default.
    * The X gate puts the qubit into the 1 state.
    * The Hadamard gate is its own inverse. Applying Hadamard the second time in a row undoes the first application of the Hadamard gate.

    ```
    <copy>
    //usr/bin/env jbang "$0" "$@" ; exit $?
    //DEPS org.redfx:strange:0.1.1
    //DEPS org.redfx:strangefx:0.1.4


    import org.redfx.strange.*;
    import org.redfx.strange.QuantumExecutionEnvironment;
    import org.redfx.strange.gate.*;
    import org.redfx.strange.local.SimpleQuantumExecutionEnvironment;
    import org.redfx.strangefx.render.Renderer;


    public class Experiments {

        public static void main (String[] args) {
            QuantumExecutionEnvironment simulator = new SimpleQuantumExecutionEnvironment();

            Program program = new Program(1);
            Step step = new Step();
            step.addGate(new X(0));
            program.addStep(step);

            Step step2 = new Step();
            step2.addGate(new Hadamard(0));
            program.addStep(step2);


            Step step3 = new Step();
            step3.addGate(new Hadamard(0));
            program.addStep(step3);

            Result result = simulator.runProgram(program);
            Qubit[] qubits = result.getQubits();
            Qubit zero = qubits[0];
            int value = zero.measure();
            Renderer.renderProgram(program);
        }
    }
    </copy>
    ```

5. The output is always 0 because 

    * Applying an X gate to a qubit in a 50:50 state has no observable effect.

    ```
    <copy>
    //usr/bin/env jbang "$0" "$@" ; exit $?
    //DEPS org.redfx:strange:0.1.1
    //DEPS org.redfx:strangefx:0.1.4


    import org.redfx.strange.*;
    import org.redfx.strange.QuantumExecutionEnvironment;
    import org.redfx.strange.gate.*;
    import org.redfx.strange.local.SimpleQuantumExecutionEnvironment;
    import org.redfx.strangefx.render.Renderer;


    public class Experiments {

        public static void main (String[] args) {
            QuantumExecutionEnvironment simulator = new SimpleQuantumExecutionEnvironment();

            Program program = new Program(1);
            Step step = new Step();
            step.addGate(new Hadamard(0));
            program.addStep(step);

            Step step2 = new Step();
            step2.addGate(new X(0));
            program.addStep(step2);


            Step step3 = new Step();
            step3.addGate(new Hadamard(0));
            program.addStep(step3);

            Result result = simulator.runProgram(program);
            Qubit[] qubits = result.getQubits();
            Qubit zero = qubits[0];
            int value = zero.measure();
            Renderer.renderProgram(program);
        }
    }
    </copy>
    ```