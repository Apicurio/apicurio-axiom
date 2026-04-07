package io.apicurio.axiom.app;

import io.quarkus.runtime.Quarkus;
import io.quarkus.runtime.annotations.QuarkusMain;

@QuarkusMain(name = "AxiomQuarkusMain")
public class AxiomQuarkusMain {
    public static void main(String... args) {
        Quarkus.run(args);
    }
}
