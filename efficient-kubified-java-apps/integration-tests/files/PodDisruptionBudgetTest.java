package org.acme.example;


import io.fabric8.kubernetes.api.model.policy.v1.PodDisruptionBudget;
import io.fabric8.kubernetes.client.KubernetesClientException;
import io.fabric8.kubernetes.client.server.mock.KubernetesServer;
import io.quarkus.test.junit.DisabledOnIntegrationTest;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.kubernetes.client.KubernetesTestServer;
import io.quarkus.test.kubernetes.client.WithKubernetesTestServer;
import org.junit.jupiter.api.Test;

import java.io.FileNotFoundException;
import java.net.URISyntaxException;

import static org.junit.jupiter.api.Assertions.assertThrows;


@WithKubernetesTestServer
@QuarkusTest
@DisabledOnIntegrationTest(forArtifactTypes = DisabledOnIntegrationTest.ArtifactType.NATIVE_BINARY)
public class PodDisruptionBudgetTest {

    @KubernetesTestServer
    private KubernetesServer mockKubernetes;

    private String pathToCustomConfig;

    private String flavoredInput = """
            apiVersion: policy/v1
            kind: PodDisruptionBudget
            metadata:
            spec:
              minAvailable: 1
              selector:
                matchLabels:
                  app.kubernetes.io/name: joker
            """;

    @Test
    public void testPdbFromFile() throws URISyntaxException, FileNotFoundException {
        pathToCustomConfig = "./src/main/kubernetes/pdb.yml";
        PodDisruptionBudget pdb = mockKubernetes.getClient().policy().v1().podDisruptionBudget().load(pathToCustomConfig).get();
        assertThrows(KubernetesClientException.class, () ->   mockKubernetes.getClient().policy().v1().podDisruptionBudget().create(pdb)) ;
    }

    @Test
    public void testCustomYAMLInput() throws URISyntaxException, FileNotFoundException {
        assertThrows(KubernetesClientException.class, () ->  mockKubernetes.getClient().policy().v1()
                .podDisruptionBudget().load(flavoredInput).dryRun()) ;
    }
}