cmake_minimum_required(VERSION 3.8)
project(oddech_gazebo)

find_package(ament_cmake REQUIRED)

install(DIRECTORY worlds models launch config DESTINATION share/${PROJECT_NAME})

# Gazebo finds model://oddech and model://oddech_flat through GZ_SIM_RESOURCE_PATH: add the installed models folder
ament_environment_hooks("${CMAKE_CURRENT_SOURCE_DIR}/hooks/${PROJECT_NAME}.dsv.in")

ament_package()
