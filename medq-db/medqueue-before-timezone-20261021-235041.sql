-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: medqueue
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `appointment_date` date NOT NULL,
  `appointment_time` time NOT NULL,
  `status` varchar(255) NOT NULL,
  `token_number` int NOT NULL,
  `doctor_id` bigint NOT NULL,
  `patient_id` bigint NOT NULL,
  `called_at` datetime(6) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `active_slot` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_appointment_active_slot` (`active_slot`),
  KEY `FKmujeo4tymoo98cmf7uj3vsv76` (`doctor_id`),
  KEY `FKopb2h9yhin1rb4dqote8bws6w` (`patient_id`),
  CONSTRAINT `FKmujeo4tymoo98cmf7uj3vsv76` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`),
  CONSTRAINT `FKopb2h9yhin1rb4dqote8bws6w` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
INSERT INTO `appointments` VALUES (1,'2026-09-23','10:00:00','COMPLETED',1,1,1,NULL,NULL,NULL),(2,'2026-09-24','11:00:00','CANCELLED',1,1,1,NULL,NULL,NULL),(3,'2026-09-28','17:00:00','CANCELLED',1,1,1,NULL,NULL,NULL),(4,'2026-09-30','10:00:00','CANCELLED',1,1,1,NULL,NULL,NULL),(5,'2026-09-22','18:00:00','COMPLETED',1,1,1,NULL,NULL,NULL),(6,'2026-10-02','10:00:00','CANCELLED',1,1,1,NULL,NULL,NULL),(7,'2026-12-01','10:00:00','CANCELLED',1,1,1,NULL,NULL,NULL),(8,'2026-09-26','13:00:00','CANCELLED',1,1,1,NULL,NULL,NULL),(9,'2026-09-25','14:00:00','CANCELLED',1,1,1,NULL,NULL,NULL),(10,'2026-09-23','13:00:00','CANCELLED',1,1,6,NULL,NULL,NULL),(11,'2026-09-22','14:00:00','COMPLETED',1,1,6,NULL,NULL,NULL),(12,'2026-09-28','11:00:00','CANCELLED',1,1,6,NULL,NULL,NULL),(13,'2026-09-30','11:00:00','CANCELLED',1,1,6,NULL,NULL,NULL),(14,'2026-09-23','13:00:00','COMPLETED',1,1,3,'2026-09-23 06:58:23.740145','2026-09-23 06:58:27.480995',NULL),(15,'2026-09-24','11:00:00','CANCELLED',1,1,6,NULL,NULL,NULL),(16,'2026-09-25','14:00:00','CANCELLED',2,1,3,NULL,NULL,NULL),(17,'2026-09-25','13:00:00','CANCELLED',3,1,6,NULL,NULL,NULL),(18,'2026-09-23','14:00:00','CANCELLED',2,1,1,NULL,NULL,NULL),(19,'2026-09-23','14:00:00','COMPLETED',3,1,1,'2026-09-23 07:22:25.353608','2026-09-23 07:25:11.142082',NULL),(20,'2026-09-23','13:30:00','COMPLETED',4,1,6,'2026-09-23 07:25:50.799456','2026-09-23 07:28:48.240715',NULL),(21,'2026-09-24','11:00:00','CANCELLED',2,1,1,NULL,NULL,NULL),(22,'2026-09-24','11:00:00','CANCELLED',3,1,1,NULL,NULL,NULL),(23,'2026-09-24','11:30:00','BOOKED',4,1,6,NULL,NULL,'1|2026-09-24|11:30'),(24,'2026-09-24','14:00:00','CANCELLED',5,1,7,NULL,NULL,NULL),(25,'2026-09-25','11:00:00','CANCELLED',4,1,8,NULL,NULL,NULL),(26,'2026-09-25','11:30:00','CANCELLED',5,1,7,NULL,NULL,NULL),(27,'2026-09-24','10:30:00','CANCELLED',1,6,1,NULL,NULL,NULL),(28,'2026-09-24','12:00:00','COMPLETED',1,7,1,'2026-09-23 21:16:38.214137','2026-09-23 21:20:17.457310',NULL),(29,'2026-09-24','12:30:00','CALLED',2,7,8,'2026-09-23 21:21:36.038286',NULL,'7|2026-09-24|12:30'),(30,'2026-09-24','13:00:00','BOOKED',3,7,7,NULL,NULL,'7|2026-09-24|13:00'),(31,'2026-09-24','12:00:00','CALLED',2,6,1,'2026-09-24 05:55:04.738987',NULL,'6|2026-09-24|12:00'),(32,'2026-09-24','12:30:00','BOOKED',3,6,7,NULL,NULL,'6|2026-09-24|12:30'),(33,'2026-10-30','12:15:00','CANCELLED',1,1,1,NULL,NULL,NULL),(35,'2026-10-22','10:00:00','CANCELLED',1,6,1,NULL,NULL,NULL),(36,'2026-10-21','23:30:00','COMPLETED',1,9,1,'2026-10-21 17:57:46.570927','2026-10-21 18:02:33.324786',NULL),(37,'2026-10-21','23:45:00','COMPLETED',2,9,8,'2026-10-21 18:03:56.349108','2026-10-21 18:05:40.667600',NULL);
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctors`
--

DROP TABLE IF EXISTS `doctors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctors` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `available_days` varchar(255) DEFAULT NULL,
  `available_time` varchar(255) DEFAULT NULL,
  `consultation_time` int DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `specialization` varchar(255) NOT NULL,
  `user_id` bigint DEFAULT NULL,
  `active` bit(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctors`
--

LOCK TABLES `doctors` WRITE;
/*!40000 ALTER TABLE `doctors` DISABLE KEYS */;
INSERT INTO `doctors` VALUES (1,'MON,TUE,WED,THU,FRI','10:00-14:00',15,'rajesh@medqueue.com','Dr. Rajesh Kumar','9876543211','Cardiology',2,NULL),(6,'MON,TUE,WED,THU,FRI','10:00-17:00',15,'anjali@gmail.com','Dr Anjali Rathore','7844598557','Gynac',11,NULL),(7,'MON,TUE,WED,THU,FRI','10:00-17:00',15,'chirag@gmail.com','Dr. Chirag Bansal','8744569855','Gastrologist',12,NULL),(8,'MON,TUE,WED,THU,FRI','10:00-17:00',15,'ankit@gmail.com','Dr. Ankit Pandey','9236587416','Orthopedic',13,NULL),(9,'MON,TUE,WED,THU,FRI','23:00-01:00',15,'patrickjanecbi@gmail.com','Dr. Patrick Jane','8988765643','Gastrologist',16,_binary '');
/*!40000 ALTER TABLE `doctors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prescription_medicines`
--

DROP TABLE IF EXISTS `prescription_medicines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prescription_medicines` (
  `prescription_id` bigint NOT NULL,
  `dosage` varchar(255) DEFAULT NULL,
  `duration` varchar(255) DEFAULT NULL,
  `frequency` varchar(255) DEFAULT NULL,
  `instructions` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  KEY `FK14vcxytfp7rr81y9fdhl37bbw` (`prescription_id`),
  CONSTRAINT `FK14vcxytfp7rr81y9fdhl37bbw` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prescription_medicines`
--

LOCK TABLES `prescription_medicines` WRITE;
/*!40000 ALTER TABLE `prescription_medicines` DISABLE KEYS */;
INSERT INTO `prescription_medicines` VALUES (1,'100kg','6','thrice','before food','jadibuti');
/*!40000 ALTER TABLE `prescription_medicines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prescriptions`
--

DROP TABLE IF EXISTS `prescriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prescriptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `diagnosis` varchar(1000) NOT NULL,
  `follow_up_date` date DEFAULT NULL,
  `instructions` varchar(2000) DEFAULT NULL,
  `appointment_id` bigint NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKr0yn695qg51gn0iskc8p0h2ii` (`appointment_id`),
  CONSTRAINT `FKe2fpvlkkcgcd40k4ufyyju2al` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prescriptions`
--

LOCK TABLES `prescriptions` WRITE;
/*!40000 ALTER TABLE `prescriptions` DISABLE KEYS */;
INSERT INTO `prescriptions` VALUES (1,'2026-10-21 16:17:38.002847','cancer 4th stage','2026-10-31','',28,'2026-10-21 16:17:38.002847');
/*!40000 ALTER TABLE `prescriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ratings`
--

DROP TABLE IF EXISTS `ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ratings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `comment` varchar(1000) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `stars` int NOT NULL,
  `appointment_id` bigint NOT NULL,
  `doctor_id` bigint NOT NULL,
  `patient_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK157o9tkh7jg0l20qmyvvbbxe1` (`appointment_id`),
  KEY `FK7mfutg9qu0l34qt6fc64bucgm` (`doctor_id`),
  KEY `FKr75yd81y8nu8wn4rca1td379i` (`patient_id`),
  CONSTRAINT `FK2y1t7p77ym3en66xplb7oo98f` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  CONSTRAINT `FK7mfutg9qu0l34qt6fc64bucgm` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`),
  CONSTRAINT `FKr75yd81y8nu8wn4rca1td379i` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ratings`
--

LOCK TABLES `ratings` WRITE;
/*!40000 ALTER TABLE `ratings` DISABLE KEYS */;
INSERT INTO `ratings` VALUES (1,NULL,'2026-10-21 17:15:48.721820',4,28,7,1),(2,NULL,'2026-10-21 17:15:58.676715',4,19,1,1),(3,NULL,'2026-10-21 17:16:03.311584',5,1,1,1),(4,NULL,'2026-10-21 18:02:56.110532',4,36,9,1);
/*!40000 ALTER TABLE `ratings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `role` enum('ADMIN','DOCTOR','PATIENT') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'2026-09-22 07:29:02.652466','patient@test.com','Test Patient','$2a$10$Mz/nQLVyxNxY6TS2kT12xuiIdi82nbUiotdCGp5P///AZbewN9u6S','9876543210','PATIENT'),(2,'2026-09-22 10:03:11.964853','doctor@test.com','Dr. Rajesh Kumar','$2a$10$bZVolN570nrxwEBl.NnJXejIm87V1SM9RddDr0WTzB93uVz0amB8u','9876543211','DOCTOR'),(3,'2026-09-22 10:54:28.509671','boradeprathmesh5@gmail.com','Prathmesh Borade','$2a$10$Pnlonmu8MWGL0mizrUABVO0e2/kaYIIwJtvhyq.H1ZeMukO.m0JZ.','09403937939','PATIENT'),(4,'2026-09-22 17:08:22.000000','admin@medqueue.com','System Admin','$2a$10$7EqJtq98hPqEX7fNZaFWoO5F6bX1L2F5q7hYqKjJ0yVhJw4u8hQmK','9999999999','ADMIN'),(5,'2026-09-22 18:58:26.002528','admin2@medqueue.com','System Administrator','$2a$10$2ZYlPXO94w3dekr0p3zOTuL8PlXCSH5NTKWbTCkCr/cLco2VyAXmO','9999999999','ADMIN'),(6,'2026-09-22 20:03:20.663109','boradeprathmesh05@gmail.com','Prathmesh Borade','$2a$10$UEjzcl8f47Cph6wvqAOuseC336wEP/xAZaFCM60g4..PDssh.Zmh2','09403937939','PATIENT'),(7,'2026-09-23 19:27:30.102046','ayushi@gmail.com','Ayushi Rathore','$2a$10$QZRzUYclZxetApmFfD5n8OJ3OrGApUNixz9lDNrkB9hW2EK4jvMJa','7845782196','PATIENT'),(8,'2026-09-23 19:30:40.292269','ayushi2@gmail.com','anshu rathore ','$2a$10$SqHPtFXqOaVle5iNFrOdg.waLCjy0BDJzty6SxpMH1Xi6Csyd/Xkm','7458126679','PATIENT'),(11,'2026-09-23 21:02:11.158656','anjali@gmail.com','Dr Anjali Rathore','$2a$10$vlkzmiifaozJLj64QmXfwe9VT0kXFRvALGK7ycNlYGJD9Uqu8rKfu','7844598557','DOCTOR'),(12,'2026-09-23 21:07:18.614627','chirag@gmail.com','Dr. Chirag Bansal','$2a$10$9kkG09SbdjiNH3kdecey8OZIHRL5JvStUSV1a587wYTJo0tZfor12','8744569855','DOCTOR'),(13,'2026-09-23 21:09:58.494359','ankit@gmail.com','Dr. Ankit Pandey','$2a$10$EsWJbp7JDEzOc/8VoFIJweR98JnpaBn4v8p6xaPP84Tdp/KdKndua','9236587416','DOCTOR'),(14,'2026-10-21 16:05:06.959883','boradeprathmesh7@gmail.com','Prathmesh Borade','$2a$10$IV2TGMCIZLrtIk0TaHo5zuKtXdvEnzl0MYBB5.YthfyvTTRpzA5lm','+919403937939','PATIENT'),(15,'2026-10-21 16:08:46.063774','superadmin@medqueue.com','MedQueue Admin','$2a$10$kBczJKmrMJ8hTAZrQe5e0OixshI1cfum6PNjZ5UsnthgNoyH4m1kq',NULL,'ADMIN'),(16,'2026-10-21 17:56:07.771959','patrickjanecbi@gmail.com','Dr. Patrick Jane','$2a$10$dHqSA7pgXma9JE5JlkJ82O.TvAVpkcJ65nmHAH1Gnq0inpY4FyJf6','8988765643','DOCTOR');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'medqueue'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-21 23:50:42
