# Adjust resources

## Introduction

This section walks you through the steps needed to adjust resource quotas to efficiently run 'Joker' Java application.

Estimated Time: 50 minutes

### Objectives

In this section, you will:
* Discover namespace resource limits
* Understand a few details about JVM ergonomics
* Adjust container resources for 'Joker' application

### Prerequisites


This section assumes you have:
* An Oracle Cloud account with access to a Kubernetes cluster.
* All previous sections successfully completed.
* Access to a container registry that is reachable from your Kubernetes cluster.


## Task 1: Setup and Discover Namespace Limits

By using resource quotas, cluster administrators can restrict resource consumption and creation on a namespace basis.

When deploying multiple applications, there will always be concerns that one Pod or Container could monopolize all available resources. To avoid such situations, a Pod or Container can consume as much memory and CPU as defined by the namespace’s resource quota.



1. Run the following command to discover the resource quota established for your namespace :

```bash
<copy>
   kubectl get resourcequota
</copy>
```

2. At namespace level a LimitRange policy is employed to constrain resource allocations (to Pods or Containers).
Run the following command to establish a namespace LimitRange

```bash
<copy>
   kubectl apply -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/limit-ranger.yaml
</copy>
```

3. You can find out the LimitRange established for a namespace by running:

```bash
<copy> 
   kubectl get limitrange
</copy>
```

The output would be similar to:

| NAME            | CREATED AT             |
|-----------------|------------------------|
| resource-limits | 2022-08-21T16:53:16Z   |
{: title="Output"}


4. Get the details of the LimitRange resource named `resource-limits` :

```bash
<copy>
   kubectl describe limitrange resource-limits
</copy>
```

The output would be similar to:

| Type           | Resource | Min | Max | Default Request | Default Limit | Max Limit/Request Ratio |
|----------------|----------|-----|-----|-----------------|---------------|-------------------------|
| Container      | cpu      | -   | -   | 10m             | 1             | -                       |
| Container      | memory   | -   | -   | 64Mi            | 750Mi         | -                       |
{: title="Output"}

This `LimitRange` enforces the default request/limit for compute resources in the namespace and automatically injects them to Containers at runtime.
Any deployment that does not have requests or limits set (like the one done in the previous section) will use these default parameters.

5. Get the external IP associated via Ingress by running the following command :
  
  ```bash
   <copy>
   kubectl get svc
   </copy>
  ```

The output should be similar to: 

```
NAME         TYPE           CLUSTER-IP    EXTERNAL-IP     PORT(S)             AGE
joker        LoadBalancer   10.96.82.30   158.101.33.40   80:32510/TCP        14m
```

In this case we can see that the load balancer has been created and the external-IP address is available. If the External IP address is listed as `<pending>` then the load balancer is still being created, wait a short while then try the command again.

 **Make a note of this external IP address, you'll be using it a lot!** 
 Or use the following command to export it:
  
  ```bash
   <copy>
      export EXTERNAL_IP=<External IP>
   </copy>
  ```

6. In order to get the memory and CPU values used by the JVM, run the following command (change the hostname to yours):
   
```bash
   <copy>
      curl $EXTERNAL_IP/jokes/sysresources
   </copy>
```

The output should be similar to: `Memory: 181 Cores: 1`.

If the memory limit is set to 750Mi, why does the JVM use only 334Mi? The JVM  has some default ergonomics and we will inspect them in the following task.


## Task 2: Observe Default JVM Ergonomics

If a memory value is not set, the JVM comes with a default memory as starting point. This value is relative to the total amount of memory available to the container and it is 1/4 of its value.

When you invoked `jokes/sysresources` endpoint, you could see the available memory was 181. The total memory available in the Pod is 750Mi, and 1/4 of this memory is 187 which is close value to we got in the application.

Also, the JVM uses a default Garbage Collector implementation depending on amount of CPU and memory available.

| Resources available                              | GC algorithm  | 
|--------------------------------------------------|---------------|
| Fewer than two CPUs and less than 2GB of memory  | Serial GC     | 
| >= 2 CPU’s and >=2GB of memory                   | G1GC          | 
{: title="Default GC algorithms"}

You can override the default algorithm, for example starting the application with `-XX:+UseG1GC` to force the usage of G1GC algorithm.

To know exactly which values are used, you can start the JVM with the following flags set:

| Flag Name and Value       | Description                                                                                                        | 
|---------------------------|--------------------------------------------------------------------------------------------------------------------|
| -XshowSettings:system     | Shows system settings detected/set by JVM.                                                                         | 
| -Xlog:gc=info             | Shows information about GC (i.e which algorithm is used)                                                           | 
| -Xlog:os+container=trace  | Print whether or not container detection is actually working and what values the JVM is determining to be in place |
{: title="Some JVM flags to observe JVM settings"}


1. In the terminal window, run the following command to deploy `Joker` service as before but with a few extra flags

```bash
<copy>
   kubectl apply -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/deploy-joker-app-show-prop.yaml
</copy>
```

The above command deploy the `Joker` service with `-XshowSettings:system -Xlog:gc=info -Xlog:os+container=info` flags set.


2. Validate your deployment by running the command:

    ```bash
    <copy>
      kubectl get pods
    </copy>
    ```
The output should be similar to: 

| NAME                   | READY | STATUS  | RESTARTS | AGE    |
|------------------------|-------|---------|----------|--------|
| joker-5bfcbdf9d4-bsgkh | 1/1   | Running | 0        | 113s   |
{: title="Result"}

3. Query the log of the Pod to see the defaults used:

```bash
<copy>
   kubectl logs joker-5bfcbdf9d4-bsgkh
</copy>
```

   You should see something similar to:

   ```text
   [0.001s][info][os,container] Memory Limit is: 786432000
   [0.004s][info][gc          ] Using Serial
   Operating System Metrics:
   Provider: cgroupv1
   Effective CPU Count: 1
   CPU Period: 100000us
   CPU Quota: 100000us
   CPU Shares: 10us
   List of Processors, 4 total:
   0 1 2 3
   List of Effective Processors, 4 total:
   0 1 2 3
   List of Memory Nodes, 1 total:
   0
   List of Available Memory Nodes, 1 total:
   0
   Memory Limit: 750.00M
   Memory Soft Limit: Unlimited
   Memory & Swap Limit: 750.00M
   
   [0.130s][info][gc          ] GC(0) Pause Young (Allocation Failure) 3M->1M(11M) 1.930ms
   [0.350s][info][gc          ] GC(1) Pause Young (Allocation Failure) 4M->1M(11M) 4.179ms
   [0.527s][info][gc          ] GC(2) Pause Young (Allocation Failure) 5M->2M(11M) 1.901ms
   [0.653s][info][gc          ] GC(3) Pause Young (Allocation Failure) 5M->2M(11M) 1.413ms
   [0.764s][info][gc          ] GC(4) Pause Young (Allocation Failure) 6M->3M(11M) 1.598ms
   [0.856s][info][gc          ] GC(5) Pause Young (Allocation Failure) 7M->4M(11M) 1.025ms
   [0.942s][info][gc          ] GC(6) Pause Young (Allocation Failure) 7M->4M(11M) 1.644ms
   [1.040s][info][gc          ] GC(7) Pause Young (Allocation Failure) 7M->4M(11M) 1.687ms
   [1.160s][info][gc          ] GC(8) Pause Young (Allocation Failure) 8M->5M(11M) 1.943ms
   [1.316s][info][gc          ] GC(9) Pause Young (Allocation Failure) 8M->5M(11M) 1.662ms
   [1.410s][info][gc          ] GC(10) Pause Young (Allocation Failure) 8M->5M(11M) 1.900ms
   [1.517s][info][gc          ] GC(11) Pause Young (Allocation Failure) 9M->6M(11M) 2.443ms
   [1.606s][info][gc          ] GC(12) Pause Young (Allocation Failure) 9M->6M(11M) 1.490ms
   [1.720s][info][gc          ] GC(13) Pause Young (Allocation Failure) 9M->6M(11M) 1.445ms
   [1.827s][info][gc          ] GC(14) Pause Young (Allocation Failure) 10M->6M(11M) 1.452ms
   [1.929s][info][gc          ] GC(15) Pause Full (Metadata GC Threshold) 8M->7M(17M) 18.560ms
   [2.122s][info][gc          ] GC(16) Pause Young (Allocation Failure) 12M->7M(17M) 2.150ms
   ......
   ```
In the above output you can observe that the total amount of memory available in the node is used, together with  GC serial algorithm as there is only one CPU available.

3. Clean up

```bash
<copy>
   kubectl delete -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/deploy-joker-app-show-prop.yaml
</copy>
```

## Task 3: Adjust Container Resources

When you want to deploy a containerized application via a Pod, you can optionally specify how many compute resources (usually CPU and memory) a container needs. CPU is a compressible resource and memory is not.Kubernetes schedules a Pod based on the requests values and it allows it to consume more based on the limits values.

Adjusting resources depends on the application you are developing, whether it’s an enterprise application or a stateless service. 

The JVM reads the number of processors available only during startup time so *CPU requests* must be established as accurate as possible. *CPU limits* are not mandatory to set. If you are worried about CPU consumption, you should set CPU limits to a value equal to CPU requests.

*Memory limits* is the container memory, so you need to count not only the JVM heap memory but all the memory required by the container. Is highly encouraged you to set request and limit value to the same value for JVM based applications.

During this task we will improve the resource requests and limits used by the application by simulating traffic and adjusting the limits.


1. Deploy the application again:

```bash
<copy>
   kubectl apply -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/deploy-joker-app.yaml
</copy>
```

2. Reinitialize the complete set of data:

```bash
   <copy>
      curl $EXTERNAL_IP/jokes/init
   </copy>
```

3. Obtain the name of the pod by running the following command:

```bash
<copy>
   kubectl get pods
</copy>
```

The output should be similart to:


```output
NAME                     READY   STATUS    RESTARTS   AGE
joker-9658dfbb8-fcwjk   1/1     Running   0          6m16s
```

4. Find out the CPU and memory consumed by querying the metrics server installed in the provisiong section:

```bash
<copy>
   kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/default/pods/joker-9658dfbb8-fcwjk
</copy>
```


5. Simulate some load using [hey](https://github.com/rakyll/hey):

```bash
   <copy>
      hey -n 100 -c 20  http://$EXTERNAL_IP/jokes
   </copy>
```   

4. Execute the following command to observe the CPU and memory consumed:

```bash
<copy>
   kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/default/pods/joker-9658dfbb8-fcwjk
</copy>
```

5. Based on the output of above command you can adjust the limits in the Kubernetes resources to :

```bash
<copy>
   kubectl apply -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/deploy-joker-app-limits.yaml
</copy>
```

The above command will update the resources with:

```yaml
<copy>
resources:
   limits:
      memory: 300Mi
   requests:
      cpu: 100m
      memory: 300Mi
</copy>
```

You can also generate the YAML file using Quarkus Kubernetes extension. 
You can change the requests and limits in the `application.properties` file with the following properties:

```properties
<copy>
# Configuration file
# key = value
quarkus.kubernetes.resources.limits.memory=300Mi
quarkus.kubernetes.resources.requests.cpu=200m
quarkus.kubernetes.resources.requests.memory=300Mi
</copy>
```

6. Validate your deployment by running the command:

```bash
<copy>
   kubectl get pods
</copy>
```

The output should be similar to:

| NAME                   | READY | STATUS  | RESTARTS | AGE |
|------------------------|-------|---------|----------|-----|
| joker-7fdcc4d6bc-vb82k | 1/1   | Running | 0        | 6s  |

7. Query the log of the Pod to see the defaults used:

```bash
   <copy>
      kubectl logs joker-7fdcc4d6bc-vb82k
   </copy>
```

   You should see something similar to:

   ```text
   [0.001s][info][os,container] Memory Limit is: 314572800
   [0.003s][info][gc          ] Using Serial
   Operating System Metrics:
   Provider: cgroupv1
   Effective CPU Count: 1
   CPU Period: 100000us
   CPU Quota: 20000us
   CPU Shares: 102us
   List of Processors, 4 total:
   0 1 2 3
   List of Effective Processors, 4 total:
   0 1 2 3
   List of Memory Nodes, 1 total:
   0
   List of Available Memory Nodes, 1 total:
   0
   Memory Limit: 300.00M
   Memory Soft Limit: Unlimited
   Memory & Swap Limit: 300.00M
   
   [0.877s][info][gc          ] GC(0) Pause Young (Allocation Failure) 2M->0M(7M) 2.830ms
   [1.575s][info][gc          ] GC(1) Pause Young (Allocation Failure) 2M->1M(7M) 83.962ms
   [3.179s][info][gc          ] GC(2) Pause Young (Allocation Failure) 3M->1M(7M) 2.867ms
   [3.983s][info][gc          ] GC(3) Pause Young (Allocation Failure) 4M->2M(7M) 1.593ms
   [4.783s][info][gc          ] GC(4) Pause Young (Allocation Failure) 4M->2M(7M) 1.295ms
   [5.884s][info][gc          ] GC(5) Pause Young (Allocation Failure) 4M->2M(7M) 1.122ms
   [6.480s][info][gc          ] GC(6) Pause Young (Allocation Failure) 4M->3M(7M) 1.312ms
   [7.074s][info][gc          ] GC(7) Pause Young (Allocation Failure) 5M->3M(7M) 86.597ms
   [7.779s][info][gc          ] GC(8) Pause Young (Allocation Failure) 5M->4M(7M) 1.343ms
   [8.579s][info][gc          ] GC(9) Pause Young (Allocation Failure) 6M->4M(7M) 1.163ms
   [8.981s][info][gc          ] GC(10) Pause Young (Allocation Failure) 6M->4M(7M) 1.417ms
   [9.585s][info][gc          ] GC(11) Pause Young (Allocation Failure) 6M->4M(7M) 1.153ms
   [10.873s][info][gc          ] GC(12) Pause Young (Allocation Failure) 6M->4M(7M) 81.875ms
   [11.882s][info][gc          ] GC(13) Pause Young (Allocation Failure) 7M->5M(7M) 2.464ms
   [12.586s][info][gc          ] GC(14) Pause Young (Allocation Failure) 7M->5M(7M) 1.196ms
   [12.875s][info][gc          ] GC(15) Pause Full (Allocation Failure) 5M->5M(13M) 288.872ms
   [14.384s][info][gc          ] GC(16) Pause Young (Allocation Failure) 9M->5M(13M) 9.611ms
   [16.479s][info][gc          ] GC(17) Pause Young (Allocation Failure) 9M->6M(13M) 3.107ms
   [17.879s][info][gc          ] GC(18) Pause Young (Allocation Failure) 10M->6M(13M) 1.139ms
   [19.678s][info][gc          ] GC(19) Pause Young (Allocation Failure) 10M->6M(13M) 99.601ms
   [21.776s][info][gc          ] GC(20) Pause Young (Allocation Failure) 10M->7M(13M) 91.749ms
   [23.878s][info][gc          ] GC(21) Pause Full (Metadata GC Threshold) 11M->7M(19M) 200.650ms
   ......
   ```
8. Run the following request to get the parameters used by the JVM, changing the hostname with yours:

```bash
   <copy>
      curl $EXTERNAL_IP/jokes/sysresources
   </copy>
```

The output should be similar to: ` Memory: 121 Cores: 1`. The memory is using the new limits which are around the 25% of memory available.
The container memory is not only used for allocating the JVM heap memory but also for the JVM itself and the container.
For this reason, a good rule of thumb is allocating a maximum of 75% of container memory for the heap.


9. Undeploy the application:

```bash
<copy>
      kubectl delete -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/deploy-joker-app-limits.yaml
</copy>
```

## Task 4: Adjust Container Resources and JVM heap size

Setting the GC configuration is essential when deploying a Java application in a container.

Several studies suggest the initial heap size and maximum heap size to the same value. Use the `-XX: InitialRAMPercentage` flag to set the initial value.
Determine which GC to use depends on the amount of CPU and memory you assign to the container:


| Amount of CPU and Memory | GC algorithm | 
|--------------------------|--------------|
| 1 CPU                    | Serial GC    | 
| 2 CPU < 4Gb              | ParallelGC   | 
| 2 CPU > 4Gb              |G1GC or ShenandoahGC|
| 2 CPU > 28Gb             | ZGC          |
{: title="GC algorithms based on CPU and Memory"}

On the other hand, you should set the `-XX:MaxRAMPercentage` flag in order to have the JVM heap size dynamically using a percentage of the total available memory (`-XX:MaxRAMPercentage=75`).

1. Deploy the application again:

```
<copy>
   kubectl apply -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/deploy-joker-app-75.yaml
</copy>
```

2. Validate your deployment by running the command:

```
   <copy>
      kubectl get pods
   </copy>
```

The output should be similar to:

| NAME                     | READY | STATUS  | RESTARTS | AGE  |
|--------------------------|-------|---------|----------|------|
| joker-844948d479-c5v9k   | 1/1   | Running | 0        | 6s   |

3.   In order to get the memory and CPU values used by the JVM, run the following command (change the hostname to yours):

```
   <copy>
      curl $EXTERNAL_IP/jokes/sysresources
   </copy>
```

The output should be similar to: `Memory: 218 Cores: 1`. Now the application is using 75% of memory as heap.


## Learn More

* [Efficient Resource Management with Kubernetes](https:dn.dev/kube-dev-practices)
* [Best Practices for Kube-Native Java Apps Workshop](https://redhat-scholars.github.io/kube-native-java-apps)

## Acknowledgements
* **Authors** - Ana-Maria Mihalceanu, Sr. Developer Advocate, Oracle | Elder Moraes, Developer Advocate, Red Hat
* **Last Updated By/Date** - Ana-Maria Mihalceanu,  September 2022
