cmake_minimum_required(VERSION 3.8)
project(oddech_description)

find_package(ament_cmake REQUIRED)

install(DIRECTORY urdf meshes launch rviz DESTINATION share/${PROJECT_NAME})

# Gazebo resolves package://oddech_description/... through GZ_SIM_RESOURCE_PATH: add <prefix>/share to it
ament_environment_hooks("${CMAKE_CURRENT_SOURCE_DIR}/hooks/${PROJECT_NAME}.dsv.in")

ament_package()
