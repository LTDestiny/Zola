import java.io.*;
import java.net.*;

public class TestRedis {
    public static void main(String[] args) throws Exception {
        System.out.println("Connecting to redis:6379...");
        try (Socket s = new Socket("redis", 6379);
             PrintWriter out = new PrintWriter(s.getOutputStream(), true);
             BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream()))) {
            out.print("AUTH redis_pass\r\n");
            out.flush();
            String line = in.readLine();
            System.out.println("AUTH response: " + line);
            out.print("KEYS session:*\r\n");
            out.flush();
            for (int i = 0; i < 10; i++) {
                line = in.readLine();
                if (line == null) break;
                System.out.println(line);
            }
        } catch (Exception e) {
            System.out.println("ERROR: " + e.getMessage());
        }
    }
}
